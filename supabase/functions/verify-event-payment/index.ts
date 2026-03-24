import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, error: "Payment not completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Verify the session belongs to this user
    if (session.metadata?.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Session mismatch" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const registrationId = session.metadata?.registration_id;
    const eventId = session.metadata?.event_id;
    const membershipIncluded = session.metadata?.membership_included === "true";

    if (!registrationId) throw new Error("Registration ID not found in session");

    // Store the Stripe payment intent ID for potential refunds
    const stripePaymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent?.id || null;

    // Update registration payment status to paid using service role (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from("event_registrations")
      .update({ 
        payment_status: "paid",
        status: "paid",
        stripe_payment_intent_id: stripePaymentIntentId,
      })
      .eq("id", registrationId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Registration update error:", updateError);
      throw new Error("Failed to update registration");
    }

    if (membershipIncluded) {
      const { error: membershipError } = await supabaseAdmin.rpc("activate_membership", {
        user_id_param: user.id,
      });

      if (membershipError) {
        console.error("Membership activation error:", membershipError);
        throw new Error("Payment verified but failed to activate membership");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: eventId || null 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Verify event payment error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
