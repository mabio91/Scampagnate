import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  applyRegistrationChangeRequest,
  buildRegistrationChangeQuote,
  cancelActiveRegistrationChanges,
  cents,
  quoteToRequestRow,
} from "../_shared/registration-change.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const isAllowedReturnUrl = (value: unknown, allowedHosts: string[]) => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "scampagnate:") {
      return ["payment-success", "payment-cancelled"].includes(url.hostname);
    }
    if (url.protocol === "https:") return allowedHosts.includes(url.hostname);
    return false;
  } catch (_error) {
    return false;
  }
};

const withCheckoutParams = (baseUrl: string, params: string) => {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${params}`;
};

type PaymentTransactionRow = {
  stripe_payment_intent_id?: string | null;
  amount?: number | string | null;
};

const getAuthenticatedUser = async (req: Request, supabaseClient: ReturnType<typeof createClient>) => {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
  if (!token) throw new Error("User not authenticated");
  const { data, error } = await supabaseClient.auth.getUser(token);
  if (error || !data.user?.email) throw new Error("User not authenticated");
  return data.user;
};

const getRefundPaymentIntentId = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  registrationId: string,
  fallbackPaymentIntentId: string | null,
  refundAmount: number,
) => {
  const { data: transactions } = await supabaseAdmin
    .from("registration_payment_transactions")
    .select("stripe_payment_intent_id, amount")
    .eq("registration_id", registrationId)
    .eq("kind", "payment")
    .order("created_at", { ascending: false });

  const matching = ((transactions || []) as PaymentTransactionRow[]).find((transaction) =>
    transaction.stripe_payment_intent_id && Number(transaction.amount || 0) >= refundAmount
  );
  return matching?.stripe_payment_intent_id || fallbackPaymentIntentId;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const user = await getAuthenticatedUser(req, supabaseClient);
    const {
      eventId,
      registrationId,
      priceOptionId,
      mode = "quote",
      returnUrlBase,
      cancelUrlBase,
    } = await req.json();

    if (!registrationId) {
      return jsonResponse({ error: "Registration is required" }, 400);
    }

    if (mode === "cancel") {
      await cancelActiveRegistrationChanges(supabaseAdmin, registrationId, user.id);
      return jsonResponse({ cancelled: true });
    }

    if (!eventId || !priceOptionId) {
      return jsonResponse({ error: "Event, registration and price option are required" }, 400);
    }

    const quote = await buildRegistrationChangeQuote(supabaseAdmin, {
      eventId,
      registrationId,
      userId: user.id,
      newPriceOptionId: priceOptionId,
    });

    if (mode === "quote") {
      return jsonResponse({ quote });
    }

    await cancelActiveRegistrationChanges(supabaseAdmin, registrationId, user.id);

    const initialStatus = quote.additionalPaymentAmount > 0
      ? "requires_payment"
      : quote.refundAmount > 0
        ? "processing"
        : "completed";
    const { data: changeRequest, error: insertError } = await supabaseAdmin
      .from("registration_change_requests")
      .insert(quoteToRequestRow(quote, initialStatus))
      .select("*")
      .single();
    if (insertError || !changeRequest) throw insertError || new Error("Unable to create change request");

    if (quote.additionalPaymentAmount > 0) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });
      const customers = await stripe.customers.list({ email: user.email || undefined, limit: 1 });
      const customerId = customers.data[0]?.id;
      const origin = req.headers.get("origin") || "https://scampagnate.app";
      const originHost = (() => {
        try {
          return new URL(origin).hostname;
        } catch (_error) {
          return "scampagnate.app";
        }
      })();
      const allowedHosts = [originHost, "scampagnate.app", "scampagnate.com"];
      const successBase = isAllowedReturnUrl(returnUrlBase, allowedHosts) ? returnUrlBase : `${origin}/payment-success`;
      const cancelBase = isAllowedReturnUrl(cancelUrlBase, allowedHosts) ? cancelUrlBase : `${origin}/event/${eventId}`;
      const successParams = `session_id={CHECKOUT_SESSION_ID}&event_id=${encodeURIComponent(eventId)}&registration_id=${encodeURIComponent(registrationId)}`;
      const cancelParams = `payment_cancelled=1&event_id=${encodeURIComponent(eventId)}&registration_id=${encodeURIComponent(registrationId)}&change_request_id=${encodeURIComponent(String(changeRequest.id))}`;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email || undefined,
        payment_method_types: ["card", "link"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: quote.eventTitle,
                description: `Differenza cambio formula: ${quote.oldPriceOptionName} -> ${quote.newPriceOptionName}`,
              },
              unit_amount: cents(quote.additionalPaymentAmount),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: withCheckoutParams(successBase as string, successParams),
        cancel_url: withCheckoutParams(cancelBase as string, cancelParams),
        metadata: {
          type: "registration_change",
          change_request_id: changeRequest.id,
          user_id: user.id,
          event_id: eventId,
          registration_id: registrationId,
          old_price_option_id: quote.oldPriceOptionId || "",
          new_price_option_id: quote.newPriceOptionId,
          booking_amount_cents: String(cents(quote.additionalPaymentAmount)),
        },
      });

      const { error: updateError } = await supabaseAdmin
        .from("registration_change_requests")
        .update({
          stripe_checkout_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", changeRequest.id);
      if (updateError) throw updateError;

      return jsonResponse({
        url: session.url,
        changeRequestId: changeRequest.id,
        quote,
      });
    }

    if (quote.refundAmount > 0) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });
      const { data: registration } = await supabaseAdmin
        .from("event_registrations")
        .select("stripe_payment_intent_id")
        .eq("id", registrationId)
        .single();
      const paymentIntentId = await getRefundPaymentIntentId(
        supabaseAdmin,
        registrationId,
        registration?.stripe_payment_intent_id || null,
        quote.refundAmount,
      );
      if (!paymentIntentId) {
        throw new Error("Pagamento originale non trovato per il rimborso automatico.");
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: cents(quote.refundAmount),
        metadata: {
          type: "registration_change",
          change_request_id: changeRequest.id,
          registration_id: registrationId,
          event_id: eventId,
        },
      });

      await applyRegistrationChangeRequest(supabaseAdmin, changeRequest, {
        stripeRefundId: refund.id,
      });

      return jsonResponse({
        completed: true,
        refunded: true,
        changeRequestId: changeRequest.id,
        quote,
      });
    }

    await applyRegistrationChangeRequest(supabaseAdmin, changeRequest);
    return jsonResponse({
      completed: true,
      changeRequestId: changeRequest.id,
      quote,
    });
  } catch (error) {
    console.error("Registration change error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unable to change registration formula" },
      500,
    );
  }
});
