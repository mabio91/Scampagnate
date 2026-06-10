import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { lookupStripeFeeDetails, type StripeFeeDetails } from "../_shared/stripe-fees.ts";

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

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
};

const uniquePaymentIntentIds = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string" && item.startsWith("pi_"))
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 100);
};

const MAX_STRIPE_LOOKUP_CONCURRENCY = 8;

type SupabaseAdminClient = ReturnType<typeof createClient>;

const toStoredFeeDetails = (row: Record<string, unknown>): StripeFeeDetails | null => {
  const feeAmount = Number(row.stripe_fee_amount || 0);
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) return null;
  return {
    stripe_fee_amount: feeAmount,
    stripe_net_amount: row.stripe_net_amount == null ? null : Number(row.stripe_net_amount),
    stripe_balance_transaction_id: typeof row.stripe_balance_transaction_id === "string" ? row.stripe_balance_transaction_id : null,
  };
};

const fetchCachedFeeDetails = async (supabaseAdmin: SupabaseAdminClient, paymentIntentIds: string[]) => {
  const cachedFees = new Map<string, StripeFeeDetails>();
  if (paymentIntentIds.length === 0) return cachedFees;

  const { data, error } = await supabaseAdmin
    .from("user_payment_transactions")
    .select("stripe_payment_intent_id, stripe_balance_transaction_id, stripe_fee_amount, stripe_net_amount")
    .eq("kind", "payment")
    .in("stripe_payment_intent_id", paymentIntentIds)
    .gt("stripe_fee_amount", 0);
  if (error) throw error;

  for (const row of data || []) {
    const paymentIntentId = row.stripe_payment_intent_id;
    const details = toStoredFeeDetails(row);
    if (typeof paymentIntentId === "string" && details && !cachedFees.has(paymentIntentId)) {
      cachedFees.set(paymentIntentId, details);
    }
  }

  return cachedFees;
};

const persistFeeDetails = async (
  supabaseAdmin: SupabaseAdminClient,
  paymentIntentId: string,
  details: StripeFeeDetails,
) => {
  const { error } = await supabaseAdmin
    .from("user_payment_transactions")
    .update({
      stripe_balance_transaction_id: details.stripe_balance_transaction_id,
      stripe_fee_amount: details.stripe_fee_amount,
      stripe_net_amount: details.stripe_net_amount,
    })
    .eq("kind", "payment")
    .eq("stripe_payment_intent_id", paymentIntentId);

  if (error) {
    console.warn("Unable to persist Stripe fee details:", {
      paymentIntentId,
      error: error.message,
    });
  }
};

const mapWithConcurrency = async <T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) => {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, values.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  }));

  return results;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonResponse({ error: "Missing authorization token" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) {
      return jsonResponse({ error: "User not authenticated" }, 401);
    }

    const { data: role, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!role) {
      return jsonResponse({ error: "Admin role required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const paymentIntentIds = uniquePaymentIntentIds(body.paymentIntentIds);
    if (paymentIntentIds.length === 0) {
      return jsonResponse({ fees: {}, unavailable: [] });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const fees: Record<string, StripeFeeDetails> = {};
    const unavailable: string[] = [];
    const cachedFees = await fetchCachedFeeDetails(supabaseAdmin, paymentIntentIds);

    for (const [paymentIntentId, details] of cachedFees) {
      fees[paymentIntentId] = details;
    }

    const uncachedPaymentIntentIds = paymentIntentIds.filter((paymentIntentId) => !cachedFees.has(paymentIntentId));

    const lookupResults = await mapWithConcurrency(uncachedPaymentIntentIds, MAX_STRIPE_LOOKUP_CONCURRENCY, async (paymentIntentId) => {
      const details = await lookupStripeFeeDetails(stripe, paymentIntentId);
      if (!details || details.stripe_fee_amount <= 0) {
        return { paymentIntentId, details: null };
      }

      await persistFeeDetails(supabaseAdmin, paymentIntentId, details);
      return { paymentIntentId, details };
    });

    for (const { paymentIntentId, details } of lookupResults) {
      if (!details) {
        unavailable.push(paymentIntentId);
        continue;
      }

      fees[paymentIntentId] = details;
    }

    return jsonResponse({ fees, unavailable });
  } catch (error) {
    console.error("Admin Stripe fee lookup error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unable to lookup Stripe fees" },
      500,
    );
  }
});
