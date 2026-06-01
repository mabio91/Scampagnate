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
    "sex",
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

type PaymentType = "free" | "paid" | "deposit" | "location";
type BalancePaymentMode = "online" | "on_site" | null;

type PaymentConfig = {
  paymentType: PaymentType;
  totalPrice: number;
  depositAmount: number;
  balancePaymentMode: BalancePaymentMode;
  priceOptionName: string;
};

type SupabaseFilterQuery = {
  eq: (column: string, value: unknown) => SupabaseFilterQuery;
  maybeSingle: () => PromiseLike<{ data?: unknown; error?: Error | null }>;
};

type SupabaseQuery = {
  select: (columns?: string) => SupabaseFilterQuery;
  insert: (values: Record<string, unknown>) => PromiseLike<{ error?: Error | null }>;
};

type SupabaseDiscountClient = {
  from: (table: string) => SupabaseQuery;
};

const normalizePaymentType = (value: unknown, fallback: PaymentType): PaymentType => {
  if (value === "free" || value === "paid" || value === "deposit" || value === "location") return value;
  return fallback;
};

const normalizeBalancePaymentMode = (value: unknown): BalancePaymentMode =>
  value === "on_site" ? "on_site" : value === "online" ? "online" : null;

const resolvePaymentConfig = (
  event: Record<string, any>,
  priceOption: Record<string, any> | null
): PaymentConfig => {
  const eventPaymentType = normalizePaymentType(event.payment_type, "free");
  const paymentType = normalizePaymentType(priceOption?.payment_type, eventPaymentType);
  const totalPrice = Number(priceOption?.price ?? event.price ?? 0);
  const depositAmount = paymentType === "deposit"
    ? Number(priceOption?.deposit_amount ?? event.deposit ?? 0)
    : 0;
  const balancePaymentMode = paymentType === "deposit"
    ? (normalizeBalancePaymentMode(priceOption?.balance_payment_mode) ??
      normalizeBalancePaymentMode(event.balance_payment_mode) ??
      "online")
    : null;

  return {
    paymentType,
    totalPrice,
    depositAmount,
    balancePaymentMode,
    priceOptionName: String(priceOption?.name ?? ""),
  };
};

const requiresOnlinePayment = (paymentType: PaymentType) =>
  paymentType === "paid" || paymentType === "deposit";

const acceptsRegistrationStatus = (status: unknown) =>
  ["available", "published", "open"].includes(String(status ?? ""));

const isRegistrationCapacityError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("posti disponibili")
    || message.includes("posti dedicati")
    || message.includes("formula di prezzo selezionata");
};

const recordDiscountUsage = async (
  supabaseAdmin: unknown,
  params: {
    discountCodeId: string;
    userId: string;
    eventId: string;
    originalPrice: number;
    discountedPrice: number;
  },
) => {
  const db = supabaseAdmin as SupabaseDiscountClient;
  const { data: existingUsage, error: existingUsageError } = await db
    .from("discount_code_usage")
    .select("id")
    .eq("discount_code_id", params.discountCodeId)
    .eq("user_id", params.userId)
    .eq("event_id", params.eventId)
    .maybeSingle();

  if (existingUsageError) throw existingUsageError;
  if (existingUsage) return;

  const { error: usageError } = await db.from("discount_code_usage").insert({
    discount_code_id: params.discountCodeId,
    user_id: params.userId,
    event_id: params.eventId,
    original_price: params.originalPrice,
    discounted_price: params.discountedPrice,
  });

  if (usageError) throw usageError;
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
    const { eventId, registrationId, discountCodeId, priceOptionId, paymentChoice, returnUrlBase, cancelUrlBase } = await req.json();
    if (!eventId || !registrationId) throw new Error("Event ID and Registration ID required");

    const { data: registration, error: registrationError } = await supabaseAdmin
      .from("event_registrations")
      .select("id, user_id, status, price_option_id, payment_status, amount_paid, total_price_amount, deposit_amount, balance_due_amount, balance_payment_mode, sport_level")
      .eq("id", registrationId)
      .eq("event_id", eventId)
      .single();

    if (registrationError || !registration) throw new Error("Registration not found");
    if (!registration.user_id || String(registration.sport_level || "").startsWith("manual:")) {
      throw new Error("Manual participant registrations cannot start checkout");
    }

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
      .select("id, title, price, deposit, payment_type, balance_payment_mode, spots_total, spots_taken, status, cancellation_policy, access_rules")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("membership_status, membership_registration_date, birth_date, sex, birth_place, province_of_birth, residential_address, city_of_residence, province_of_residence")
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

    const effectivePriceOptionId = priceOptionId || registration.price_option_id || null;
    let priceOption: Record<string, any> | null = null;

    if (effectivePriceOptionId) {
      const { data: option, error: poError } = await supabaseAdmin
        .from("event_price_options")
        .select("id, event_id, name, price, payment_type, deposit_amount, balance_amount, balance_payment_mode, has_dedicated_spots, dedicated_spots, spots_taken, waitlist_enabled")
        .eq("id", effectivePriceOptionId)
        .eq("event_id", eventId)
        .single();
      if (poError || !option) throw new Error("Price option not found");
      priceOption = option;
    }

    const paymentConfig = resolvePaymentConfig(event, priceOption);
    const { paymentType, totalPrice, depositAmount, balancePaymentMode, priceOptionName } = paymentConfig;
    const isBalanceCheckout = registration.payment_status === "deposit_paid";
    const normalizedPaymentChoice = paymentChoice === "full" ? "full" : "deposit";
    const storedBalanceDue = Number(registration.balance_due_amount ?? 0);
    const configuredBalanceDue = Math.max(0, totalPrice - Number(registration.deposit_amount || depositAmount));

    // Determine base amount
    let description: string;
    let originalPrice: number;
    let checkoutKind: "full" | "deposit" | "balance" = "full";

    const optionSuffix = priceOptionName ? ` — ${priceOptionName}` : "";
    if (paymentType === "deposit" && isBalanceCheckout) {
      checkoutKind = "balance";
      originalPrice = storedBalanceDue > 0 ? storedBalanceDue : configuredBalanceDue;
      description = `Saldo per "${event.title}"${optionSuffix}`;
    } else if (paymentType === "deposit") {
      checkoutKind = normalizedPaymentChoice === "full" ? "full" : "deposit";
      originalPrice = checkoutKind === "full" ? totalPrice : depositAmount;
      description = checkoutKind === "full"
        ? `Pagamento completo per "${event.title}"${optionSuffix}`
        : `Acconto per "${event.title}"${optionSuffix} (Totale: €${Number(totalPrice).toFixed(2)})`;
    } else if (paymentType === "paid") {
      originalPrice = totalPrice;
      description = `Pagamento completo per "${event.title}"${optionSuffix}`;
    } else {
      throw new Error("This event does not require online payment");
    }

    if (paymentType === "deposit" && balancePaymentMode === "on_site" && !isBalanceCheckout && normalizedPaymentChoice === "full") {
      throw new Error("Per questo evento è possibile pagare online solo l'acconto.");
    }

    if (paymentType === "deposit" && balancePaymentMode === "on_site" && isBalanceCheckout) {
      throw new Error("Il saldo di questo evento va pagato sul posto.");
    }

    if (checkoutKind !== "balance") {
      let optionIsBookable = false;
      if (!acceptsRegistrationStatus(event.status)) {
        optionIsBookable = false;
      } else if (effectivePriceOptionId) {
        const { data: availabilityRows, error: availabilityError } = await supabaseAdmin
          .rpc("get_event_option_availability", { p_event_id: eventId });
        if (availabilityError) throw availabilityError;
        const availability = (availabilityRows || []).find((row: any) => row.option_id === effectivePriceOptionId);
        optionIsBookable = Boolean(availability?.is_bookable);
      } else {
        optionIsBookable = Number(event.spots_total || 0) - Number(event.spots_taken || 0) > 0;
      }

      if (!optionIsBookable) {
        return new Response(
          JSON.stringify({ error: "Non ci sono posti disponibili al momento. Resti in lista d'attesa." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    let finalPrice = originalPrice;
    let waivesServiceFee = false;
    let appliedDiscountCodeId: string | null = null;
    let discountOriginalPrice = 0;
    let discountFinalPrice = 0;

    // Apply discount if provided
    if (discountCodeId) {

      const { data: discount, error: discountError } = await supabaseAdmin
        .from("discount_codes")
        .select("*")
        .eq("id", discountCodeId)
        .eq("is_active", true)
        .single();

      if (discountError || !discount) throw new Error("Invalid discount code");

      waivesServiceFee = discount.waives_service_fee === true;

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

      appliedDiscountCodeId = discountCodeId;
      discountOriginalPrice = originalPrice;
      discountFinalPrice = finalPrice;

      description += ` (Discount: ${discount.code})`;
    }

    const eventAmountCents = Math.round(finalPrice * 100);
    const serviceFeeCents = checkoutKind === "balance"
      ? 0
      : waivesServiceFee
        ? 0
        : (requiresOnlinePayment(paymentType) ? SERVICE_FEE_EUR * 100 : 0);
    const bookingAmountCents = eventAmountCents + serviceFeeCents;
    const totalAmountCents = bookingAmountCents + membershipFeeCents;
    const totalPriceAmount = Math.max(totalPrice, Number(registration.total_price_amount || 0), Number(finalPrice || 0));
    const depositAmountValue = paymentType === "deposit"
      ? Number(registration.deposit_amount || depositAmount)
      : null;
    const registrationUpdate: Record<string, unknown> = {
      cancellation_policy: event.cancellation_policy || null,
      refund_percentage: 0,
      refund_amount: 0,
      total_price_amount: paymentType === "deposit" ? totalPriceAmount : null,
      deposit_amount: depositAmountValue,
      balance_payment_mode: paymentType === "deposit" ? balancePaymentMode : null,
    };

    if (checkoutKind !== "balance") {
      Object.assign(registrationUpdate, {
        balance_due_amount: paymentType === "deposit"
          ? (checkoutKind === "deposit" ? Math.max(0, totalPriceAmount - Number(finalPrice)) : 0)
          : null,
      });
    }

    const { error: registrationUpdateError } = await supabaseAdmin
      .from("event_registrations")
      .update(registrationUpdate)
      .eq("id", registrationId);
    if (registrationUpdateError) throw registrationUpdateError;

    if (totalAmountCents <= 0) {
      if (appliedDiscountCodeId) {
        await recordDiscountUsage(supabaseAdmin, {
          discountCodeId: appliedDiscountCodeId,
          userId,
          eventId,
          originalPrice: discountOriginalPrice,
          discountedPrice: discountFinalPrice,
        });
      }

      const freeStatus = paymentType === "deposit" && checkoutKind === "deposit" ? "deposit_paid" : "paid";
      const settledEventAmount = checkoutKind === "deposit" ? originalPrice : totalPriceAmount;
      const { error: freeUpdateError } = await supabaseAdmin
        .from("event_registrations")
        .update({
          payment_status: freeStatus,
          status: freeStatus,
          balance_due_amount: freeStatus === "deposit_paid" ? Math.max(0, totalPriceAmount - settledEventAmount) : 0,
          balance_payment_mode: paymentType === "deposit" ? balancePaymentMode : null,
        })
        .eq("id", registrationId);
      if (freeUpdateError) throw freeUpdateError;

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
    const originHost = (() => {
      try {
        return new URL(origin).hostname;
      } catch (_error) {
        return "scampagnate.app";
      }
    })();
    const allowedHosts = [originHost, "scampagnate.app", "scampagnate.com"];
    const successBase = typeof returnUrlBase === "string" && isAllowedReturnUrl(returnUrlBase, allowedHosts) ? returnUrlBase : `${origin}/payment-success`;
    const cancelBase = typeof cancelUrlBase === "string" && isAllowedReturnUrl(cancelUrlBase, allowedHosts) ? cancelUrlBase : `${origin}/event/${eventId}`;
    const successParams = `session_id={CHECKOUT_SESSION_ID}&event_id=${encodeURIComponent(eventId)}&registration_id=${encodeURIComponent(registrationId)}`;
    const cancelParams = `payment_cancelled=1&event_id=${encodeURIComponent(eventId)}&registration_id=${encodeURIComponent(registrationId)}`;

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
            name: "Tessera Associativa ASD Gruppo Scampagnate",
            description: "Quota associativa annuale ASD Gruppo Scampagnate",
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
      success_url: withCheckoutParams(successBase, successParams),
      cancel_url: withCheckoutParams(cancelBase, cancelParams),
      metadata: {
        user_id: userId,
        event_id: eventId,
        registration_id: registrationId,
        payment_type: paymentType,
        price_option_id: effectivePriceOptionId || "",
        checkout_kind: checkoutKind,
        balance_payment_mode: balancePaymentMode || "",
        discount_code_id: appliedDiscountCodeId || "",
        discount_original_cents: appliedDiscountCodeId ? String(Math.round(discountOriginalPrice * 100)) : "",
        discount_final_cents: appliedDiscountCodeId ? String(Math.round(discountFinalPrice * 100)) : "",
        membership_included: String(membershipFeeCents > 0),
        membership_fee_cents: String(membershipFeeCents),
        event_amount_cents: String(eventAmountCents),
        booking_amount_cents: String(bookingAmountCents),
        service_fee_cents: String(serviceFeeCents),
        total_amount_cents: String(totalAmountCents),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Event checkout error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to create checkout session" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isRegistrationCapacityError(error) ? 400 : 500,
    });
  }
});
