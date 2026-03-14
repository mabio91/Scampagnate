import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { eventId, registrationId } = await req.json();
    if (!eventId || !registrationId) throw new Error("Event ID and Registration ID required");

    // Fetch event details
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select("id, title, price, deposit, payment_type")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    // Determine amount to charge
    let amountCents: number;
    let description: string;

    if (event.payment_type === "deposit" && event.deposit) {
      amountCents = Math.round(Number(event.deposit) * 100);
      description = `Deposit for "${event.title}" (Total: €${Number(event.price).toFixed(2)})`;
    } else if (event.payment_type === "paid") {
      amountCents = Math.round(Number(event.price) * 100);
      description = `Full payment for "${event.title}"`;
    } else {
      throw new Error("This event does not require online payment");
    }

    if (amountCents <= 0) throw new Error("Invalid payment amount");

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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: event.title,
              description,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&event_id=${eventId}&registration_id=${registrationId}`,
      cancel_url: `${origin}/event/${eventId}`,
      metadata: {
        user_id: user.id,
        event_id: eventId,
        registration_id: registrationId,
        payment_type: event.payment_type,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Event checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
