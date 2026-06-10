import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  finalizeEventCheckoutSession,
  finalizeMembershipCheckoutSession,
  finalizeRegistrationChangeCheckoutSession,
} from "../_shared/stripe-payment-finalizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const webhookSecret =
    Deno.env.get("STRIPE_WEBHOOK_SECRET") ||
    Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET");
  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured");
    return jsonResponse({ error: "Webhook secret not configured" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ error: "Missing Stripe signature" }, 400);
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return jsonResponse({ error: "Invalid webhook signature" }, 400);
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return jsonResponse({ received: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    if (session.metadata?.type === "membership") {
      const result = await finalizeMembershipCheckoutSession({ session, stripe, supabaseAdmin });
      return jsonResponse({ received: true, result });
    }

    if (session.metadata?.type === "registration_change") {
      const result = await finalizeRegistrationChangeCheckoutSession({ session, stripe, supabaseAdmin });
      return jsonResponse({ received: true, result });
    }

    if (session.metadata?.registration_id) {
      const result = await finalizeEventCheckoutSession({
        session,
        stripe,
        supabaseAdmin,
      });
      return jsonResponse({ received: true, result });
    }

    return jsonResponse({ received: true, ignored: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      500
    );
  }
});
