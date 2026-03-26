import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY_1") || Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");

    // Auth
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

    // Rate limit: check last OTP sent in last 30 seconds
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
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    
    // Hash OTP for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const otpHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Delete old OTPs for this user
    await supabase
      .from("phone_otps")
      .delete()
      .eq("user_id", user.id);

    // Store hashed OTP
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("phone_otps")
      .insert({
        user_id: user.id,
        phone_number: phone,
        otp_hash: otpHash,
        channel,
        expires_at: expiresAt,
      });
    if (insertError) throw new Error(`Failed to store OTP: ${insertError.message}`);

    // Send via Twilio
    const message = `Il tuo codice di verifica Scampagnate è: ${otp}. Scade tra 5 minuti.`;
    
    let toNumber = phone;
    let fromNumber = TWILIO_PHONE_NUMBER;
    
    if (channel === "whatsapp") {
      toNumber = `whatsapp:${phone}`;
      fromNumber = `whatsapp:${TWILIO_PHONE_NUMBER}`;
    }

    const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toNumber,
        From: fromNumber,
        Body: message,
      }),
    });

    const twilioData = await twilioResponse.json();
    
    if (!twilioResponse.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));
      
      // If WhatsApp fails, suggest SMS fallback
      if (channel === "whatsapp") {
        return new Response(
          JSON.stringify({ error: "WhatsApp non disponibile, usa SMS", fallback: "sms" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Failed to send OTP: ${JSON.stringify(twilioData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, channel }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-otp error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
