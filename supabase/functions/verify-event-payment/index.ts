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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    let authenticatedUserId: string | null = null;

    if (token) {
      const { data } = await supabaseClient.auth.getUser(token);
      authenticatedUserId = data.user?.id ?? null;
      if (!authenticatedUserId) throw new Error("User not authenticated");
    }

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
    const sessionUserId = session.metadata?.user_id || null;
    const membershipIncluded = session.metadata?.membership_included === "true";
    const bookingAmountCents = Number(session.metadata?.booking_amount_cents || "0");
    const checkoutKind = (session.metadata?.checkout_kind || "full") as "full" | "deposit" | "balance";
    const userId = authenticatedUserId || sessionUserId;

    if (!registrationId) throw new Error("Registration ID not found in session");
    if (!userId) throw new Error("User not found in session");
    if (authenticatedUserId && sessionUserId && authenticatedUserId !== sessionUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Session mismatch" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const stripePaymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent?.id || null;

    // Check if registration still exists
    const { data: reg, error: regError } = await supabaseAdmin
      .from("event_registrations")
      .select("id, status, payment_status, event_id, amount_paid, service_fee_amount, total_price_amount, deposit_amount, balance_due_amount")
      .eq("id", registrationId)
      .eq("user_id", userId)
      .single();

    if (regError || !reg) {
      // Registration was cleaned up — auto-refund
      if (stripePaymentIntentId && bookingAmountCents > 0) {
        try {
          await stripe.refunds.create({ payment_intent: stripePaymentIntentId, amount: bookingAmountCents });
        } catch (e) {
          console.error("Refund error for missing registration:", e);
        }
      }
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "La registrazione non è più disponibile. Ti abbiamo rimborsato automaticamente.",
          auto_refunded: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Already processed — idempotent
    if (
      reg.payment_status === "paid" ||
      (checkoutKind === "deposit" && reg.payment_status === "deposit_paid")
    ) {
      return new Response(
        JSON.stringify({ success: true, eventId: eventId || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // CRITICAL: Check if spots are available (race condition protection)
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("spots_total, spots_taken, status, title")
      .eq("id", reg.event_id)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    const spotsAvailable = event.spots_total - event.spots_taken;

    if (checkoutKind !== "balance" && spotsAvailable <= 0) {
      // RACE CONDITION: Another user got the spot first
      // Auto-refund this payment
      if (stripePaymentIntentId && bookingAmountCents > 0) {
        try {
          await stripe.refunds.create({ payment_intent: stripePaymentIntentId, amount: bookingAmountCents });
          console.log(`Auto-refunded payment ${stripePaymentIntentId} — spot taken by another user`);
        } catch (refundErr) {
          console.error("Auto-refund error:", refundErr);
        }
      }

      // Keep registration as waitlist (user stays in line)
      await supabaseAdmin
        .from("event_registrations")
        .update({ 
          payment_status: "refunded",
          status: "waitlist",
          stripe_payment_intent_id: stripePaymentIntentId,
          refund_percentage: 100,
          refund_amount: bookingAmountCents / 100,
          refund_status: "completed",
        })
        .eq("id", registrationId)
        .eq("user_id", userId);

      // Notify user
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        type: "waitlist_spot_lost",
        title: "Posto già assegnato",
        message: `Il posto per "${event.title}" è stato appena preso da un altro partecipante. Nessun problema: ti abbiamo rimborsato automaticamente. Resti in lista d'attesa.`,
        event_id: reg.event_id,
      });

      // Activate membership if included (they still paid for it)
      if (membershipIncluded) {
        await supabaseAdmin.rpc("activate_membership", { user_id_param: userId });
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          spot_taken: true,
          auto_refunded: true,
          eventId: eventId || null,
          message: "Il posto è stato appena preso da un altro partecipante. Nessun problema: ti abbiamo rimborsato automaticamente."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const nextStatus = checkoutKind === "deposit" ? "deposit_paid" : "paid";
    const nextBalanceDueAmount = checkoutKind === "deposit"
      ? Math.max(0, Number(reg.total_price_amount || 0) - Number(reg.deposit_amount || 0))
      : 0;

    // Spot is available — confirm registration
    const { error: updateError } = await supabaseAdmin
      .from("event_registrations")
      .update({ 
        payment_status: nextStatus,
        status: nextStatus,
        stripe_payment_intent_id: stripePaymentIntentId,
        refund_status: "not_requested",
        balance_due_amount: nextBalanceDueAmount,
      })
      .eq("id", registrationId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Registration update error:", updateError);
      throw new Error("Failed to update registration");
    }

    if (membershipIncluded) {
      const { error: membershipError } = await supabaseAdmin.rpc("activate_membership", {
        user_id_param: userId,
      });
      if (membershipError) {
        console.error("Membership activation error:", membershipError);
      }
    }

    // Clean up any other stale pending registrations for the same user+event
    await supabaseAdmin
      .from("event_registrations")
      .delete()
      .eq("event_id", reg.event_id)
      .eq("user_id", userId)
      .eq("payment_status", "pending")
      .neq("id", registrationId);

    return new Response(
      JSON.stringify({ success: true, eventId: eventId || null }),
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
