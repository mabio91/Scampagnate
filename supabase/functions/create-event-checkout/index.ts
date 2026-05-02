import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const SERVICE_FEE_EUR = 1;

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
    const { eventId, registrationId, discountCodeId, priceOptionId, paymentChoice } = await req.json();
    if (!eventId || !registrationId) throw new Error("Event ID and Registration ID required");

    const { data: registration, error: registrationError } = await supabaseAdmin
      .from("event_registrations")
      .select("id, user_id, status, price_option_id, payment_status, amount_paid, total_price_amount, deposit_amount, balance_due_amount, balance_payment_mode")
      .eq("id", registrationId)
      .eq("event_id", eventId)
      .single();

    if (registrationError || !registration) throw new Error("Registration not found");

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

    let userId = registration.user_id;
    let userEmail: string | null = null;

    if (token) {
      const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && authData.user) {
        userId = authData.user.id;
        userEmail = authData.user.email ?? null;
      }
    }

    if (userId !== registration.user_id) {
      throw new Error("Registration does not belong to the authenticated user");
    }

    if (!userEmail) {
      const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(registration.user_id);
      if (authUserError || !authUser.user?.email) throw new Error("User not authenticated");
      userEmail = authUser.user.email;
    }

    // Clean up any stale pending registrations (older than 30 min) for this user+event
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("event_registrations")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .eq("payment_status", "pending")
      .neq("id", registrationId)
      .lt("created_at", thirtyMinAgo);

    // Fetch event details using admin client to bypass RLS
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, price, deposit, payment_type, balance_payment_mode, spots_total, spots_taken, cancellation_policy, access_rules")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    // Check if registration is from waitlist — if so, verify spot availability
    if (registration.status === "waitlist") {
      const availableSpots = event.spots_total - event.spots_taken;
      if (availableSpots <= 0) {
        return new Response(
          JSON.stringify({ error: "Non ci sono posti disponibili al momento. Resti in lista d'attesa." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("membership_status, membership_registration_date, birth_date, birth_place, province_of_birth, residential_address, city_of_residence, province_of_residence")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new Error("Unable to verify membership status");

    const hasActiveMembership = (() => {
      if (profile?.membership_status !== "Active") return false;
      if (!profile?.membership_registration_date) return true;

      const regDate = new Date(profile.membership_registration_date);
      if (Number.isNaN(regDate.getTime())) return true;

      // Calendar year expiry: Dec 31 of the registration year
      const year = regDate.getFullYear();
      const expiry = new Date(year, 11, 31, 23, 59, 59, 999);
      return new Date() < expiry;
    })();

    const eventRequiresMembership = Array.isArray(event.access_rules?.rules) &&
      event.access_rules.rules.some((rule: { type?: string }) => rule.type === "require_membership");

    if ((eventRequiresMembership || !hasActiveMembership) && !hasCompleteMembershipData(profile)) {
      return new Response(
        JSON.stringify({ error: "Completa i dati per il tesseramento prima di procedere." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch membership fee from platform_settings
    let membershipFeeEuros = 10; // fallback
    const { data: feeSetting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "membership_fee")
      .single();
    if (feeSetting?.value) {
      const parsed = Number(feeSetting.value);
      if (!isNaN(parsed) && parsed >= 0) membershipFeeEuros = parsed;
    }
    const membershipFeeCents = hasActiveMembership ? 0 : Math.round(membershipFeeEuros * 100);

    // Check if registration has a price option
    let priceOptionName = "";
    let effectivePriceOptionId = priceOptionId;
    
    if (!effectivePriceOptionId) {
      // Check the registration for a stored price_option_id
      if (registration.price_option_id) {
        effectivePriceOptionId = registration.price_option_id;
      }
    }

    const totalEventPrice = effectivePriceOptionId ? 0 : Number(event.price || 0);
    const configuredDepositAmount = Number(event.deposit || 0);
    const balancePaymentMode = event.payment_type === "deposit"
      ? (event.balance_payment_mode === "on_site" ? "on_site" : "online")
      : null;
    const isBalanceCheckout = registration.payment_status === "deposit_paid";
    const normalizedPaymentChoice = paymentChoice === "full" ? "full" : "deposit";

    // Determine base amount
    let description: string;
    let originalPrice: number;
    let checkoutKind: "full" | "deposit" | "balance" = "full";

    if (effectivePriceOptionId) {
      const { data: priceOption, error: poError } = await supabaseClient
        .from("event_price_options")
        .select("name, price")
        .eq("id", effectivePriceOptionId)
        .single();
      if (poError || !priceOption) throw new Error("Price option not found");

      const optionPrice = Number(priceOption.price);
      originalPrice = optionPrice;
      priceOptionName = priceOption.name;
      description = `"${event.title}" — ${priceOption.name}`;

      if (event.payment_type === "deposit") {
        if (isBalanceCheckout) {
          checkoutKind = "balance";
          originalPrice = Math.max(0, optionPrice - Number(registration.deposit_amount || configuredDepositAmount));
          description = `Saldo per "${event.title}" — ${priceOption.name}`;
        } else if (normalizedPaymentChoice === "deposit") {
          checkoutKind = "deposit";
          originalPrice = configuredDepositAmount;
          description = `Acconto per "${event.title}" — ${priceOption.name}`;
        } else {
          checkoutKind = "full";
          description = `Pagamento completo per "${event.title}" — ${priceOption.name}`;
        }
      }
    } else if (event.payment_type === "deposit" && isBalanceCheckout) {
      checkoutKind = "balance";
      originalPrice = Number(registration.balance_due_amount ?? Math.max(0, totalEventPrice - Number(registration.deposit_amount || configuredDepositAmount)));
      description = `Saldo per "${event.title}"`;
    } else if (event.payment_type === "deposit" && event.deposit) {
      checkoutKind = normalizedPaymentChoice === "full" ? "full" : "deposit";
      originalPrice = checkoutKind === "full" ? totalEventPrice : configuredDepositAmount;
      description = checkoutKind === "full"
        ? `Pagamento completo per "${event.title}"`
        : `Acconto per "${event.title}" (Totale: €${Number(event.price).toFixed(2)})`;
    } else if (event.payment_type === "paid") {
      originalPrice = Number(event.price);
      description = `Pagamento completo per "${event.title}"`;
    } else {
      throw new Error("This event does not require online payment");
    }

    if (event.payment_type === "deposit" && balancePaymentMode === "on_site" && !isBalanceCheckout && normalizedPaymentChoice === "full") {
      throw new Error("Per questo evento è possibile pagare online solo l'acconto.");
    }

    if (event.payment_type === "deposit" && balancePaymentMode === "on_site" && isBalanceCheckout) {
      throw new Error("Il saldo di questo evento va pagato sul posto.");
    }

    let finalPrice = originalPrice;

    // Apply discount if provided
    if (discountCodeId) {

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
        .eq("user_id", userId)
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
        user_id: userId,
        event_id: eventId,
        original_price: originalPrice,
        discounted_price: finalPrice,
      });

      description += ` (Discount: ${discount.code})`;
    }

    const eventAmountCents = Math.round(finalPrice * 100);
    const serviceFeeCents = checkoutKind === "balance"
      ? 0
      : (event.payment_type === "paid" || event.payment_type === "deposit" ? SERVICE_FEE_EUR * 100 : 0);
    const bookingAmountCents = eventAmountCents + serviceFeeCents;
    const totalAmountCents = bookingAmountCents + membershipFeeCents;
    const totalPriceAmount = effectivePriceOptionId
      ? Math.max(originalPrice, Number(registration.total_price_amount || 0), Number(finalPrice || 0))
      : Number(event.price || 0);
    const depositAmountValue = event.payment_type === "deposit"
      ? Number(registration.deposit_amount || configuredDepositAmount)
      : null;

    await supabaseAdmin
      .from("event_registrations")
      .update({
        amount_paid: checkoutKind === "balance"
          ? Number(registration.amount_paid || 0) + bookingAmountCents / 100
          : bookingAmountCents / 100,
        cancellation_policy: event.cancellation_policy || null,
        service_fee_amount: serviceFeeCents / 100,
        refund_percentage: 0,
        refund_amount: 0,
        refund_status: registration.payment_status === "paid" ? "completed" : "pending",
        total_price_amount: event.payment_type === "deposit" ? totalPriceAmount : null,
        deposit_amount: depositAmountValue,
        balance_due_amount: event.payment_type === "deposit"
          ? (checkoutKind === "deposit" ? Math.max(0, totalPriceAmount - Number(finalPrice)) : 0)
          : null,
        balance_payment_mode: event.payment_type === "deposit" ? balancePaymentMode : null,
      })
      .eq("id", registrationId);

    if (totalAmountCents <= 0) {
      const freeStatus = event.payment_type === "deposit" && checkoutKind === "deposit" ? "deposit_paid" : "paid";
      await supabaseAdmin
        .from("event_registrations")
        .update({
          payment_status: freeStatus,
          status: freeStatus,
          balance_due_amount: freeStatus === "deposit_paid" ? Math.max(0, totalPriceAmount - Number(finalPrice)) : 0,
          balance_payment_mode: event.payment_type === "deposit" ? balancePaymentMode : null,
        })
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
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://scampagnate.app";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (eventAmountCents > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: event.title,
            description,
          },
          unit_amount: eventAmountCents,
        },
        quantity: 1,
      });
    }

    if (serviceFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: "Costo del servizio",
            description: "Costo del servizio non rimborsabile in caso di cancellazione utente idonea al rimborso",
          },
          unit_amount: serviceFeeCents,
        },
        quantity: 1,
      });
    }

    if (membershipFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: "Annual Membership",
            description: "Scampagnate membership fee",
          },
          unit_amount: membershipFeeCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      payment_method_types: ["card", "link"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&event_id=${eventId}&registration_id=${registrationId}`,
      cancel_url: `${origin}/event/${eventId}`,
      metadata: {
        user_id: userId,
        event_id: eventId,
        registration_id: registrationId,
        payment_type: event.payment_type,
        checkout_kind: checkoutKind,
        balance_payment_mode: balancePaymentMode || "",
        discount_code_id: discountCodeId || "",
        membership_included: String(membershipFeeCents > 0),
        booking_amount_cents: String(bookingAmountCents),
        service_fee_cents: String(serviceFeeCents),
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
