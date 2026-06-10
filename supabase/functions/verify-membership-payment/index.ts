import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { finalizeMembershipCheckoutSession } from "../_shared/stripe-payment-finalizer.ts";

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

const getSessionId = async (req: Request) => {
  const url = new URL(req.url);
  const sessionIdFromUrl =
    url.searchParams.get("session_id") || url.searchParams.get("sessionId");

  if (sessionIdFromUrl) return sessionIdFromUrl;
  if (req.method === "GET" || req.method === "HEAD") return null;

  const rawBody = await req.text();
  if (!rawBody.trim()) return null;

  try {
    const body = JSON.parse(rawBody);
    return typeof body.sessionId === "string" ? body.sessionId : null;
  } catch (error) {
    console.error("Invalid verify-membership-payment JSON body:", error);
    return null;
  }
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
    const sessionId = await getSessionId(req);
    if (!sessionId) {
      return jsonResponse({ success: false, error: "Session ID required" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return jsonResponse({ success: false, error: "Pagamento non ancora confermato" }, 400);
    }

    const sessionUserId = session.metadata?.user_id;
    if (!sessionUserId) {
      return jsonResponse({ success: false, error: "Session missing user metadata" }, 400);
    }

    if (session.metadata?.type && session.metadata.type !== "membership") {
      return jsonResponse({ success: false, error: "Invalid membership session" }, 400);
    }

    const token = getBearerToken(req);
    if (token) {
      const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && authData.user && authData.user.id !== sessionUserId) {
        return jsonResponse({ success: false, error: "Session mismatch" }, 403);
      }
    }

    const result = await finalizeMembershipCheckoutSession({ session, stripe, supabaseAdmin });
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    console.error("Verify membership error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Verification failed" },
      500
    );
  }
});
