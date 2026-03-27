import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Policy windows in hours
const POLICY_WINDOWS: Record<string, number> = {
  flexible: 24,
  moderate: 48,
  non_refundable: -1, // never refundable
  strict: -1, // legacy mapping
};

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
      .select("id, payment_status, stripe_payment_intent_id, status")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .in("status", ["registered", "paid"])
      .maybeSingle();

    if (regError) throw new Error("Failed to fetch registration");
    if (!registration) {
      return new Response(
        JSON.stringify({ refunded: false, reason: "no_registration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // If no payment was made, just cancel without refund
    if (registration.payment_status !== "paid" || !registration.stripe_payment_intent_id) {
      // Cancel the registration
      await supabaseAdmin
        .from("event_registrations")
        .update({ status: "cancelled" })
        .eq("id", registration.id);

      return new Response(
        JSON.stringify({ refunded: false, reason: "no_payment", cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get event details for policy check
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("date, time, cancellation_policy")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    // Parse cancellation policy
    let policyKey = "flexible"; // default
    const rawPolicy = event.cancellation_policy || "";
    const colonIdx = rawPolicy.indexOf(":");
    if (colonIdx !== -1) {
      const prefix = rawPolicy.slice(0, colonIdx);
      if (POLICY_WINDOWS[prefix] !== undefined) policyKey = prefix;
    } else if (POLICY_WINDOWS[rawPolicy] !== undefined) {
      policyKey = rawPolicy;
    }
    // Legacy strict → non_refundable
    if (policyKey === "strict") policyKey = "non_refundable";

    const windowHours = POLICY_WINDOWS[policyKey] ?? -1;

    // Determine if refund is eligible
    let eligible = false;
    let reason = "";

    if (windowHours < 0) {
      // Non-refundable
      eligible = false;
      reason = "non_refundable";
    } else {
      // Calculate hours until event
      const eventDateTime = new Date(`${event.date}T${event.time}`);
      const now = new Date();
      const hoursUntilEvent = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilEvent >= windowHours) {
        eligible = true;
      } else {
        eligible = false;
        reason = "outside_window";
      }
    }

    // Cancel the registration regardless
    await supabaseAdmin
      .from("event_registrations")
      .update({ status: "cancelled" })
      .eq("id", registration.id);

    // Process refund if eligible
    if (eligible) {
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
          JSON.stringify({ refunded: true, cancelled: true, policy: policyKey }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } catch (stripeError: any) {
        console.error("Stripe refund error:", stripeError);
        // Registration is already cancelled, notify about refund failure
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
    }

    // Not eligible for refund - send appropriate notification
    const notifMessage = reason === "non_refundable"
      ? "La tua iscrizione è stata annullata. Questo evento ha una politica non rimborsabile."
      : "La tua iscrizione è stata annullata. Il periodo per il rimborso è scaduto.";

    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      type: "cancellation",
      title: "Iscrizione annullata",
      message: notifMessage,
      event_id: eventId,
    });

    return new Response(
      JSON.stringify({ refunded: false, cancelled: true, reason, policy: policyKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Process refund error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
