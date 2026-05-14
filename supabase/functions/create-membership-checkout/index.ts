import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const hasCompleteMembershipData = (profile: Record<string, unknown> | null) =>
  !!profile &&
  [
    "birth_date",
    "birth_place",
    "province_of_birth",
    "residential_address",
    "city_of_residence",
    "province_of_residence",
  ].every((key) => {
    const value = profile[key];
    return typeof value === "string" ? value.trim().length > 0 : value != null;
  });

const isAllowedReturnUrl = (value: unknown, allowedHosts: string[]) => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "scampagnate:") {
      return ["membership-success", "payment-cancelled"].includes(url.hostname);
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
    if (!token) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (authError || !user?.email) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Check if already an active member FOR THE CURRENT YEAR
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("membership_status, membership_registration_date, birth_date, birth_place, province_of_birth, residential_address, city_of_residence, province_of_residence")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Membership profile lookup error:", profileError);
      return new Response(JSON.stringify({ error: "Unable to verify membership status" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!hasCompleteMembershipData(profile)) {
      return new Response(
        JSON.stringify({ error: "Completa i dati per il tesseramento prima di acquistare la tessera." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (profile?.membership_status === "Active" && profile?.membership_registration_date) {
      const regDate = new Date(profile.membership_registration_date);
      const year = regDate.getFullYear();
      const expiry = new Date(year, 11, 31, 23, 59, 59, 999);
      if (new Date() < expiry) {
        return new Response(
          JSON.stringify({ error: "Your membership is still active" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    const { eventId, returnUrlBase, cancelUrlBase } = await req.json();

    // Fetch membership fee from platform_settings
    let membershipFeeEuros = 1; // fallback changed to 1 as requested
    const { data: feeSetting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "membership_fee")
      .single();
    
    if (feeSetting?.value) {
      const parsed = Number(feeSetting.value);
      if (!isNaN(parsed) && parsed >= 0) membershipFeeEuros = parsed;
    }
    const membershipFeeCents = Math.round(membershipFeeEuros * 100);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://scampagnate.app";
    const originHost = (() => {
      try {
        return new URL(origin).hostname;
      } catch (_error) {
        return "scampagnate.app";
      }
    })();
    const allowedHosts = [originHost, "scampagnate.app", "scampagnate.com"];
    const successBase = typeof returnUrlBase === "string" && isAllowedReturnUrl(returnUrlBase, allowedHosts) ? returnUrlBase : `${origin}/membership-success`;
    const cancelBase = typeof cancelUrlBase === "string" && isAllowedReturnUrl(cancelUrlBase, allowedHosts) ? cancelUrlBase : eventId ? `${origin}/event/${eventId}` : `${origin}/`;
    const successParams = `session_id={CHECKOUT_SESSION_ID}&event_id=${encodeURIComponent(eventId || "")}`;
    const cancelParams = `event_id=${encodeURIComponent(eventId || "")}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["card", "link"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Tessera Associativa ASD Scampagnate",
              description: "Quota associativa annuale - valida fino al 31 dicembre",
            },
            unit_amount: membershipFeeCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: withCheckoutParams(successBase, successParams),
      cancel_url: withCheckoutParams(cancelBase, cancelParams),
      metadata: {
        user_id: user.id,
        event_id: eventId || "",
        type: "membership",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Membership checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
