import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { finalizeEventCheckoutSession } from "../_shared/stripe-payment-finalizer.ts";

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
    const { sessionId } = await req.json();
    if (!sessionId) {
      return jsonResponse({ success: false, error: "Session ID required" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionUserId = session.metadata?.user_id || null;
    if (!sessionUserId) {
      return jsonResponse({ success: false, error: "Session missing user metadata" }, 400);
    }

    const token = getBearerToken(req);
    if (token) {
      const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && authData.user && authData.user.id !== sessionUserId) {
        return jsonResponse({ success: false, error: "Session mismatch" }, 403);
      }
    }

    const result = await finalizeEventCheckoutSession({
      session,
      stripe,
      supabaseAdmin,
    });

    return jsonResponse(
      result,
      result.success || result.auto_refunded || result.spot_taken ? 200 : 400
    );
  } catch (error) {
    console.error("Verify event payment error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Verification failed" },
      500
    );
  }
});
