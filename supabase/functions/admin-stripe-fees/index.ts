import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { lookupStripeFeeDetails } from "../_shared/stripe-fees.ts";

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

    const fees: Record<string, unknown> = {};
    const unavailable: string[] = [];

    for (const paymentIntentId of paymentIntentIds) {
      const details = await lookupStripeFeeDetails(stripe, paymentIntentId);
      if (!details || details.stripe_fee_amount <= 0) {
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
