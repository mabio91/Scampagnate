import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Check if already an active member FOR THE CURRENT YEAR
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("membership_status, membership_registration_date")
      .eq("id", user.id)
      .single();

    // Check if membership is still active (calendar year: Dec 31 of registration year)
    if (profile?.membership_status === "Active" && profile?.membership_registration_date) {
      const regDate = new Date(profile.membership_registration_date);
      const year = regDate.getFullYear();
      const expiry = new Date(year, 11, 31, 23, 59, 59, 999);
      if (new Date() < expiry) {
        return new Response(
          JSON.stringify({ error: "Your membership is still active" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    const { eventId } = await req.json();

    const origin = req.headers.get("origin") || "https://scampagnate.app";
    const successUrl = `${origin}/membership-success?event_id=${eventId || ""}`;

    // Use Stripe Payment Link with prefilled email and client reference
    const paymentLinkUrl = new URL("https://buy.stripe.com/test_9B69AL3ZI1f175ogc71Fe00");
    paymentLinkUrl.searchParams.set("prefilled_email", user.email);
    paymentLinkUrl.searchParams.set("client_reference_id", user.id);

    return new Response(JSON.stringify({ url: paymentLinkUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Membership checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
