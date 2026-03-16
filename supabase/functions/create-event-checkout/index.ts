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

    const { eventId, registrationId, discountCodeId, priceOptionId } = await req.json();
    if (!eventId || !registrationId) throw new Error("Event ID and Registration ID required");

    // Fetch event details
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select("id, title, price, deposit, payment_type")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    // Check if registration has a price option
    let priceOptionName = "";
    let effectivePriceOptionId = priceOptionId;
    
    if (!effectivePriceOptionId) {
      // Check the registration for a stored price_option_id
      const { data: reg } = await supabaseClient
        .from("event_registrations")
        .select("price_option_id")
        .eq("id", registrationId)
        .single();
      if (reg?.price_option_id) {
        effectivePriceOptionId = reg.price_option_id;
      }
    }

    // Determine base amount
    let amountCents: number;
    let description: string;
    let originalPrice: number;

    if (effectivePriceOptionId) {
      // Use price from the selected option
      const { data: priceOption, error: poError } = await supabaseClient
        .from("event_price_options")
        .select("name, price")
        .eq("id", effectivePriceOptionId)
        .single();
      if (poError || !priceOption) throw new Error("Price option not found");
      originalPrice = Number(priceOption.price);
      priceOptionName = priceOption.name;
      description = `"${event.title}" — ${priceOption.name}`;
    } else if (event.payment_type === "deposit" && event.deposit) {
      originalPrice = Number(event.deposit);
      description = `Deposit for "${event.title}" (Total: €${Number(event.price).toFixed(2)})`;
    } else if (event.payment_type === "paid") {
      originalPrice = Number(event.price);
      description = `Full payment for "${event.title}"`;
    } else {
      throw new Error("This event does not require online payment");
    }

    let finalPrice = originalPrice;

    // Apply discount if provided
    if (discountCodeId) {
      // Use service role to validate and record discount
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: discount, error: discountError } = await supabaseAdmin
        .from("discount_codes")
        .select("*")
        .eq("id", discountCodeId)
        .eq("is_active", true)
        .single();

      if (discountError || !discount) throw new Error("Invalid discount code");

      // Validate expiration
      if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
        throw new Error("Discount code expired");
      }

      // Validate max uses
      if (discount.max_uses !== null && discount.times_used >= discount.max_uses) {
        throw new Error("Discount code fully used");
      }

      // Validate event applicability
      if (!discount.applies_to_all && discount.event_ids && !discount.event_ids.includes(eventId)) {
        throw new Error("Discount code not valid for this event");
      }

      // Check duplicate usage
      const { data: existingUsage } = await supabaseAdmin
        .from("discount_code_usage")
        .select("id")
        .eq("discount_code_id", discountCodeId)
        .eq("user_id", user.id)
        .eq("event_id", eventId)
        .maybeSingle();

      if (existingUsage) throw new Error("Discount already used for this event");

      // Calculate discounted price
      if (discount.discount_type === "percentage") {
        finalPrice = Math.max(0, originalPrice - (originalPrice * Number(discount.discount_value) / 100));
      } else {
        finalPrice = Math.max(0, originalPrice - Number(discount.discount_value));
      }

      finalPrice = Math.round(finalPrice * 100) / 100;

      // Record usage
      await supabaseAdmin.from("discount_code_usage").insert({
        discount_code_id: discountCodeId,
        user_id: user.id,
        event_id: eventId,
        original_price: originalPrice,
        discounted_price: finalPrice,
      });

      description += ` (Discount: ${discount.code})`;
    }

    amountCents = Math.round(finalPrice * 100);
    if (amountCents <= 0) {
      // Free after discount — mark as paid directly
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabaseAdmin
        .from("event_registrations")
        .update({ payment_status: "paid", status: "paid" })
        .eq("id", registrationId);

      return new Response(JSON.stringify({ free: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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
        discount_code_id: discountCodeId || "",
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
