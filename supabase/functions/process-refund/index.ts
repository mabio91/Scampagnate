import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Calculate refund eligibility based on cancellation policy and event start time.
 * 
 * Policies:
 * - flexible  → 100% refund if >= 24h before event start
 * - moderate  → 100% refund if >= 48h before event start
 * - non_refundable / strict / rigida → 0% always
 */
function calculateRefundEligibility(
  cancellationPolicy: string | null,
  eventDate: string,
  eventTime: string,
  now: Date
): { eligible: boolean; refundPercentage: number; policy: string; hoursUntilEvent: number } {
  // Build event start datetime
  const eventStart = new Date(`${eventDate}T${eventTime}`);
  const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Parse policy — handle all known formats
  const rawPolicy = (cancellationPolicy || "").toLowerCase().split(":")[0];
  
  let resolvedPolicy: string;
  let requiredHours: number;

  switch (rawPolicy) {
    case "flexible":
    case "flessibile":
      resolvedPolicy = "flexible";
      requiredHours = 24;
      break;
    case "moderate":
    case "moderata":
      resolvedPolicy = "moderate";
      requiredHours = 48;
      break;
    case "non_refundable":
    case "strict":
    case "rigida":
      resolvedPolicy = "non_refundable";
      requiredHours = Infinity; // never eligible
      break;
    default:
      // Default to flexible if no policy set
      resolvedPolicy = "flexible";
      requiredHours = 24;
      break;
  }

  const eligible = requiredHours !== Infinity && hoursUntilEvent >= requiredHours;
  const refundPercentage = eligible ? 100 : 0;

  return { eligible, refundPercentage, policy: resolvedPolicy, hoursUntilEvent };
}

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
        JSON.stringify({ refunded: false, cancelled: false, reason: "no_registration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get event details for cancellation policy + start datetime
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("cancellation_policy, date, time, title")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Failed to fetch event");

    const now = new Date();

    // Waitlist users can always cancel (no payment involved typically)
    const isWaitlist = registration.status === "waitlist";

    // Calculate refund eligibility based on cancellation policy
    const refundCalc = calculateRefundEligibility(
      event.cancellation_policy,
      event.date,
      event.time,
      now
    );

    // Always cancel the registration regardless of refund eligibility
    await supabaseAdmin
      .from("event_registrations")
      .update({ status: "cancelled" })
      .eq("id", registration.id);

    // If waitlist or no payment was made → just cancel, no refund needed
    if (isWaitlist || registration.payment_status !== "paid" || !registration.stripe_payment_intent_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "cancellation",
        title: "Iscrizione annullata",
        message: isWaitlist
          ? "Sei stato rimosso dalla lista d'attesa."
          : "La tua iscrizione è stata annullata con successo.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({
          refunded: false,
          cancelled: true,
          reason: isWaitlist ? "waitlist_cancelled" : "no_payment",
          policy: refundCalc.policy,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Payment exists — check refund eligibility
    if (!refundCalc.eligible) {
      // No refund allowed — booking cancelled, spot released, no money back
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "cancellation",
        title: "Iscrizione annullata",
        message: "Prenotazione cancellata. Secondo la policy dell'evento, non è previsto alcun rimborso.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({
          refunded: false,
          cancelled: true,
          reason: "no_refund_policy",
          policy: refundCalc.policy,
          refund_percentage: 0,
          hours_until_event: Math.round(refundCalc.hoursUntilEvent),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Refund is eligible — process via Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    try {
      // Prevent double refunds by checking current payment status
      const { data: freshReg } = await supabaseAdmin
        .from("event_registrations")
        .select("payment_status")
        .eq("id", registration.id)
        .single();

      if (freshReg?.payment_status === "refunded") {
        return new Response(
          JSON.stringify({ refunded: true, cancelled: true, reason: "already_refunded", policy: refundCalc.policy }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      await stripe.refunds.create({
        payment_intent: registration.stripe_payment_intent_id,
      });

      // Update payment status to refunded
      await supabaseAdmin
        .from("event_registrations")
        .update({ payment_status: "refunded" })
        .eq("id", registration.id);

      // Send success notification
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "refund",
        title: "Rimborso elaborato",
        message: "Prenotazione cancellata con successo. Riceverai il rimborso nei prossimi giorni, secondo i tempi previsti dal tuo metodo di pagamento.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({
          refunded: true,
          cancelled: true,
          policy: refundCalc.policy,
          refund_percentage: refundCalc.refundPercentage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (stripeError: any) {
      console.error("Stripe refund error:", stripeError);

      // Mark as refund_failed
      await supabaseAdmin
        .from("event_registrations")
        .update({ payment_status: "refund_failed" })
        .eq("id", registration.id);

      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "refund_error",
        title: "Verifica rimborso in corso",
        message: "Prenotazione cancellata. Stiamo verificando il rimborso: ti aggiorneremo appena possibile.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({
          refunded: false,
          cancelled: true,
          reason: "stripe_error",
          policy: refundCalc.policy,
          error: stripeError.message,
        }),
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
