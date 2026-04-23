import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERVICE_FEE_EUR = 1;

function resolvePolicy(cancellationPolicy: string | null): { policy: string; requiredHours: number | null } {
  const rawPolicy = (cancellationPolicy || "").toLowerCase().split(":")[0];

  switch (rawPolicy) {
    case "flexible":
    case "flessibile":
    case "flexible_24h":
      return { policy: "flexible_24h", requiredHours: 24 };
    case "moderate":
    case "moderata":
    case "flexible_48h":
      return { policy: "flexible_48h", requiredHours: 48 };
    case "non_refundable":
    case "strict":
    case "rigida":
      return { policy: "non_refundable", requiredHours: null };
    default:
      return { policy: "flexible_24h", requiredHours: 24 };
  }
}

function calculateRefund(cancellationPolicy: string | null, eventDate: string, eventTime: string, amountPaid: number) {
  const eventStart = new Date(`${eventDate}T${eventTime}`);
  const now = new Date();
  const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  const { policy, requiredHours } = resolvePolicy(cancellationPolicy);
  const eligible = requiredHours !== null && hoursUntilEvent >= requiredHours;
  const refundAmount = eligible ? Math.max(0, amountPaid - SERVICE_FEE_EUR) : 0;
  const refundPercentage = amountPaid > 0 ? Math.round((refundAmount / amountPaid) * 100) : 0;

  return {
    policy,
    requiredHours,
    eligible,
    refundAmount,
    refundPercentage,
    hoursUntilEvent,
  };
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
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    let userId: string | null = null;

    if (token) {
      const { data } = await supabaseClient.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    if (!userId) throw new Error("User not authenticated");

    const { eventId } = await req.json();
    if (!eventId) throw new Error("Event ID required");

    const { data: registration, error: regError } = await supabaseAdmin
      .from("event_registrations")
      .select("id, payment_status, stripe_payment_intent_id, status, amount_paid, service_fee_amount")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .in("status", ["registered", "deposit_paid", "paid", "waitlist"])
      .maybeSingle();

    if (regError) throw new Error("Failed to fetch registration");
    if (!registration) {
      return new Response(
        JSON.stringify({ refunded: false, cancelled: false, reason: "no_registration" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("cancellation_policy, date, time, title")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Failed to fetch event");

    const isWaitlist = registration.status === "waitlist";
    const amountPaid = Number(registration.amount_paid || 0);
    const serviceFeeAmount = Number(registration.service_fee_amount ?? SERVICE_FEE_EUR);
    const refundCalc = calculateRefund(event.cancellation_policy, event.date, event.time, amountPaid || serviceFeeAmount);

    await supabaseAdmin
      .from("event_registrations")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_policy: event.cancellation_policy,
      })
      .eq("id", registration.id);

    if (isWaitlist || !["paid", "deposit_paid"].includes(registration.payment_status || "") || !registration.stripe_payment_intent_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
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

    if (!refundCalc.eligible || refundCalc.refundAmount <= 0) {
      await supabaseAdmin
        .from("event_registrations")
        .update({
          refund_percentage: 0,
          refund_amount: 0,
          refund_status: "not_eligible",
        })
        .eq("id", registration.id);

      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "cancellation",
        title: "Iscrizione annullata",
        message: "Prenotazione cancellata con successo. Secondo la policy dell'evento, non è previsto alcun rimborso.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({
          refunded: false,
          cancelled: true,
          reason: "no_refund_policy",
          policy: refundCalc.policy,
          refund_percentage: 0,
          refund_amount: 0,
          hours_until_event: Math.round(refundCalc.hoursUntilEvent),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    try {
      const { data: freshReg } = await supabaseAdmin
        .from("event_registrations")
        .select("payment_status, refund_status")
        .eq("id", registration.id)
        .single();

      if (freshReg?.payment_status === "refunded" || freshReg?.refund_status === "completed") {
        return new Response(
          JSON.stringify({
            refunded: true,
            cancelled: true,
            reason: "already_refunded",
            policy: refundCalc.policy,
            refund_amount: refundCalc.refundAmount,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      await stripe.refunds.create({
        payment_intent: registration.stripe_payment_intent_id,
        amount: Math.round(refundCalc.refundAmount * 100),
      });

      await supabaseAdmin
        .from("event_registrations")
        .update({
          payment_status: "refunded",
          refund_percentage: refundCalc.refundPercentage,
          refund_amount: refundCalc.refundAmount,
          refund_status: "completed",
          service_fee_amount: serviceFeeAmount,
        })
        .eq("id", registration.id);

      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "refund",
        title: "Rimborso elaborato",
        message: "Prenotazione cancellata con successo. Riceverai il rimborso nei prossimi giorni.",
        event_id: eventId,
      });

      return new Response(
        JSON.stringify({
          refunded: true,
          cancelled: true,
          policy: refundCalc.policy,
          refund_percentage: refundCalc.refundPercentage,
          refund_amount: refundCalc.refundAmount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (stripeError: any) {
      console.error("Stripe refund error:", stripeError);

      await supabaseAdmin
        .from("event_registrations")
        .update({
          payment_status: "refund_failed",
          refund_amount: refundCalc.refundAmount,
          refund_percentage: refundCalc.refundPercentage,
          refund_status: "failed",
        })
        .eq("id", registration.id);

      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
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
          refund_amount: refundCalc.refundAmount,
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
