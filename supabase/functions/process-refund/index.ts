import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CANCELLATION_WINDOW_HOURS = 24;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { eventId } = await req.json();
    if (!eventId) throw new Error("Event ID required");

    // Get registration with payment info
    const { data: registration, error: regError } = await supabaseAdmin
      .from("event_registrations")
      .select("id, payment_status, stripe_payment_intent_id, status, created_at")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .in("status", ["registered", "paid", "waitlist"])
      .maybeSingle();

    if (regError) throw new Error("Failed to fetch registration");
    if (!registration) {
      return new Response(
        JSON.stringify({ refunded: false, reason: "no_registration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check 24-hour cancellation window from registration time
    const registeredAt = new Date(registration.created_at);
    const now = new Date();
    const hoursSinceRegistration = (now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceRegistration > CANCELLATION_WINDOW_HOURS) {
      // Cannot cancel after 24 hours
      return new Response(
        JSON.stringify({
          refunded: false,
          cancelled: false,
          reason: "cancellation_window_expired",
          hours_since_registration: Math.round(hoursSinceRegistration),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Cancel the registration (within 24h window)
    await supabaseAdmin
      .from("event_registrations")
      .update({ status: "cancelled" })
      .eq("id", registration.id);

    // If no payment was made, just cancel without refund
    if (registration.payment_status !== "paid" || !registration.stripe_payment_intent_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "cancellation",
        title: "Iscrizione annullata",
        message: "La tua iscrizione è stata annullata con successo.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({ refunded: false, reason: "no_payment", cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Process refund (within 24h and payment exists)
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    try {
      await stripe.refunds.create({
        payment_intent: registration.stripe_payment_intent_id,
      });

      // Update payment status
      await supabaseAdmin
        .from("event_registrations")
        .update({ payment_status: "refunded" })
        .eq("id", registration.id);

      // Send notification
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "refund",
        title: "Rimborso elaborato",
        message: "Il tuo rimborso è stato elaborato automaticamente. Riceverai l'accredito entro 5-10 giorni lavorativi.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({ refunded: true, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (stripeError: any) {
      console.error("Stripe refund error:", stripeError);
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "refund_error",
        title: "Errore rimborso",
        message: "Si è verificato un errore durante il rimborso. Contatta l'organizzatore per assistenza.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({ refunded: false, cancelled: true, reason: "stripe_error", error: stripeError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
  } catch (error: any) {
    console.error("Process refund error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
