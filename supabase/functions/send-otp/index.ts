import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    if (!accountSid) throw new Error("TWILIO_ACCOUNT_SID is not configured");

    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!authToken) throw new Error("TWILIO_AUTH_TOKEN is not configured");

    const serviceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
    if (!serviceSid) throw new Error("TWILIO_VERIFY_SERVICE_SID is not configured");

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

    // Delete old OTPs for this user
    await supabase
      .from("phone_otps")
      .delete()
      .eq("user_id", user.id);

    // Send verification via Twilio Verify API
    const twilioUrl = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;
    
    const bodyParams: Record<string, string> = {
      To: channel === "whatsapp" ? `whatsapp:${phone}` : phone,
      Channel: channel,
    };

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(bodyParams),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio Verify error:", JSON.stringify(twilioData));

      // If WhatsApp fails, suggest SMS fallback
      if (channel === "whatsapp") {
        return new Response(
          JSON.stringify({ error: "WhatsApp non disponibile, usa SMS", fallback: "sms" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Failed to send OTP: ${JSON.stringify(twilioData)}`);
    }

    // Store a record for rate limiting and tracking
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase
      .from("phone_otps")
      .insert({
        user_id: user.id,
        phone_number: phone,
        otp_hash: twilioData.sid || "twilio-verify",
        channel,
        expires_at: expiresAt,
      });

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
