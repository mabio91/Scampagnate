import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWILIO_ACCOUNT_SID = "ACf3af1b91609b9829e72c133a0d77c2d6";
const TWILIO_AUTH_TOKEN = "d2b75f084eb4f86b83def39b3c7f1aa2";
const TWILIO_SENDER = "+14155238886";

serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response(null, { headers: corsHeaders }); }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { phone, channel } = await req.json();
    if (!phone || !channel) throw new Error("Missing phone or channel");
    if (!["sms", "whatsapp"].includes(channel)) throw new Error("Invalid channel");

    // Check rate limit
    const { data: recentOtp } = await supabase
      .from("phone_otps")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentOtp) {
      const elapsed = Date.now() - new Date(recentOtp.created_at).getTime();
      if (elapsed < 30000) {
        return new Response(
          JSON.stringify({ error: "Attendi 30 secondi prima di richiedere un nuovo codice", cooldown: Math.ceil((30000 - elapsed) / 1000) }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Hash OTP
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const otpHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    await supabase.from("phone_otps").delete().eq("user_id", user.id);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from("phone_otps").insert({
      user_id: user.id,
      phone_number: formattedPhone,
      otp_hash: otpHash,
      channel,
      expires_at: expiresAt,
    });
    if (insertError) throw new Error(`Failed to store OTP: ${insertError.message}`);

    const authString = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const message = `Il tuo codice di verifica Scampagnate è: ${otp}. Scade tra 5 minuti.`;

    let toNumber = formattedPhone;
    
    // Per gli SMS, usa il numero Twilio ufficiale configurato in Supabase
    let fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || TWILIO_SENDER;

    if (channel === "whatsapp") {
      toNumber = `whatsapp:${formattedPhone}`;
      // Sandbox WhatsApp number
      fromNumber = `whatsapp:${TWILIO_SENDER}`;
    }

    // Call Twilio Programmable Messaging API
    const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(bodyParams),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));

      // Rollback OTP insertion on failure to prevent rate-limit blocking
      await supabase.from("phone_otps").delete().eq("user_id", user.id);

      if (channel === "whatsapp") {
        return new Response(
          JSON.stringify({ error: "WhatsApp non disponibile, usa SMS", fallback: "sms" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Errore Twilio: ${twilioData.message || JSON.stringify(twilioData)}`);
    }

    return new Response(JSON.stringify({ success: true, channel }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("send-otp error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
