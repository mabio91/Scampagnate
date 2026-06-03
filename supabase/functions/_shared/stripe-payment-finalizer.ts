import { applyRegistrationChangeRequest } from "./registration-change.ts";
import { isEventStarted } from "./event-timing.ts";
import { centsToEuros, recordUserPaymentTransaction } from "./user-payment-transactions.ts";

type CheckoutKind = "full" | "deposit" | "balance";

type StripeSessionLike = {
  id?: string | null;
  amount_total?: number | null;
  payment_status?: string | null;
  payment_intent?: string | { id?: string | null } | null;
  metadata?: Record<string, string | undefined> | null;
};

type StripeRefundsClient = {
  refunds: {
    create: (params: { payment_intent: string; amount?: number }) => Promise<unknown>;
  };
};

type SupabaseResult<T> = { data: T | null; error: Error | null };

type SupabaseQueryBuilder<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select: (columns?: string) => SupabaseQueryBuilder<T>;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder<T>;
  neq: (column: string, value: unknown) => SupabaseQueryBuilder<T>;
  single: () => Promise<SupabaseResult<T>>;
  maybeSingle: () => Promise<SupabaseResult<T>>;
  update: (values: Record<string, unknown>) => SupabaseQueryBuilder<T>;
  delete: () => SupabaseQueryBuilder<T>;
  insert: (values: Record<string, unknown>) => Promise<SupabaseResult<T>>;
};

type SupabaseAdminClient = {
  from: <T = unknown>(table: string) => SupabaseQueryBuilder<T>;
  rpc: <T = unknown>(fn: string, params: Record<string, unknown>) => Promise<SupabaseResult<T>>;
};

type EventRegistrationRow = {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  event_id: string;
  price_option_id?: string | null;
  amount_paid?: number | string | null;
  service_fee_amount?: number | string | null;
  total_price_amount?: number | string | null;
  deposit_amount?: number | string | null;
  balance_due_amount?: number | string | null;
};

type EventRow = {
  spots_total?: number | string | null;
  spots_taken?: number | string | null;
  status?: string | null;
  title?: string | null;
  date?: string | null;
  time?: string | null;
  duration?: string | null;
};

type AvailabilityRow = {
  option_id?: string | null;
  real_remaining?: number | string | null;
};

type PriceOptionRow = {
  name?: string | null;
};

type FinalizePaymentParams = {
  session: StripeSessionLike;
  stripe: StripeRefundsClient;
  supabaseAdmin: unknown;
};

export type PaymentFinalizerResult = {
  success: boolean;
  eventId: string | null;
  spot_taken?: boolean;
  auto_refunded?: boolean;
  message?: string;
  error?: string;
};

const acceptsRegistrationStatus = (status: unknown) =>
  ["available", "published", "open"].includes(String(status ?? ""));

const isCancelledRegistrationStatus = (status: unknown) =>
  ["cancelled", "failed", "expired"].includes(String(status ?? ""));

const isRegistrationCapacityError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("posti disponibili")
    || message.includes("posti dedicati")
    || message.includes("formula di prezzo selezionata");
};

const paymentIntentIdFromSession = (session: StripeSessionLike) => {
  const paymentIntent = session.payment_intent;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id || null;
};

const refundBookingAmount = async (
  stripe: StripeRefundsClient,
  stripePaymentIntentId: string | null,
  bookingAmountCents: number,
) => {
  if (!stripePaymentIntentId || bookingAmountCents <= 0) return;
  return await stripe.refunds.create({ payment_intent: stripePaymentIntentId, amount: bookingAmountCents });
};

const eurosFromMetadataCents = (value: string | undefined) => {
  const cents = Number(value || "0");
  return Number.isFinite(cents) && cents > 0 ? Math.round(cents) / 100 : 0;
};

const ledgerAmountsFromEventSession = (session: StripeSessionLike) => {
  const bookingAmountCents = Number(session.metadata?.booking_amount_cents || "0");
  const serviceFeeCents = Number(session.metadata?.service_fee_cents || "0");
  const explicitMembershipFeeCents = Number(session.metadata?.membership_fee_cents || "0");
  const amountTotalCents = Number(session.amount_total || "0");
  const membershipFeeCents = explicitMembershipFeeCents > 0
    ? explicitMembershipFeeCents
    : session.metadata?.membership_included === "true"
      ? Math.max(0, amountTotalCents - bookingAmountCents)
      : 0;
  const eventAmountCents = Number(session.metadata?.event_amount_cents || "") || Math.max(0, bookingAmountCents - serviceFeeCents);

  return {
    amount: centsToEuros(bookingAmountCents + membershipFeeCents),
    eventAmount: centsToEuros(eventAmountCents),
    serviceFeeAmount: centsToEuros(serviceFeeCents),
    membershipFeeAmount: centsToEuros(membershipFeeCents),
    bookingAmountCents,
    serviceFeeCents,
    membershipFeeCents,
    eventAmountCents,
  };
};

const recordDiscountUsageFromSession = async (
  db: SupabaseAdminClient,
  session: StripeSessionLike,
  eventId: string | null,
  userId: string | null,
) => {
  const discountCodeId = session.metadata?.discount_code_id || null;
  if (!discountCodeId || !eventId || !userId) return;

  const originalPrice = eurosFromMetadataCents(session.metadata?.discount_original_cents);
  const discountedPrice = eurosFromMetadataCents(session.metadata?.discount_final_cents);
  if (originalPrice <= 0) {
    console.warn("Skipping discount usage recording: missing discount price metadata", {
      discountCodeId,
      eventId,
      userId,
    });
    return;
  }

  const { data: existingUsage, error: existingUsageError } = await db
    .from("discount_code_usage")
    .select("id")
    .eq("discount_code_id", discountCodeId)
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (existingUsageError) throw existingUsageError;
  if (existingUsage) return;

  const { error: usageError } = await db.from("discount_code_usage").insert({
    discount_code_id: discountCodeId,
    user_id: userId,
    event_id: eventId,
    original_price: originalPrice,
    discounted_price: discountedPrice,
  });
  if (usageError) throw usageError;
};

const refundSpotTakenRegistration = async (
  db: SupabaseAdminClient,
  stripe: StripeRefundsClient,
  params: {
    session: StripeSessionLike;
    registrationId: string;
    userId: string;
    eventId: string | null;
    registrationEventId: string;
    eventTitle: string;
    selectedOptionName: string;
    stripePaymentIntentId: string | null;
    bookingAmountCents: number;
    membershipIncluded: boolean;
  },
): Promise<PaymentFinalizerResult> => {
  if (params.stripePaymentIntentId && params.bookingAmountCents > 0) {
    try {
      await refundBookingAmount(stripe, params.stripePaymentIntentId, params.bookingAmountCents);
      await recordUserPaymentTransaction(db, {
        user_id: params.userId,
        registration_id: params.registrationId,
        event_id: params.eventId || params.registrationEventId,
        kind: "refund",
        source: "event_checkout_auto_refund",
        amount: params.bookingAmountCents / 100,
        event_amount: params.bookingAmountCents / 100,
        stripe_checkout_session_id: params.session.id || null,
        stripe_payment_intent_id: params.stripePaymentIntentId,
        metadata: {
          reason: "spot_taken",
        },
      });
      console.log(`Auto-refunded payment ${params.stripePaymentIntentId} - spot taken by another user`);
    } catch (refundError) {
      console.error("Auto-refund error:", refundError);
    }
  }

  await db
    .from("event_registrations")
    .update({
      payment_status: "refunded",
      status: "waitlist",
      stripe_payment_intent_id: params.stripePaymentIntentId,
      refund_percentage: 100,
      refund_amount: params.bookingAmountCents / 100,
      refund_status: "completed",
    })
    .eq("id", params.registrationId)
    .eq("user_id", params.userId);

  await db.from("notifications").insert({
    user_id: params.userId,
    type: "waitlist_spot_lost",
    title: "Posto non confermato",
    message: `Il posto per "${params.eventTitle || "questo evento"}${params.selectedOptionName}" è stato appena preso da un altro partecipante. Nessun problema: ti abbiamo rimborsato automaticamente. Resti in lista d'attesa.`,
    event_id: params.registrationEventId,
  });

  if (params.membershipIncluded) {
    await db.rpc("activate_membership", { user_id_param: params.userId });
  }

  return {
    success: false,
    spot_taken: true,
    auto_refunded: true,
    eventId: params.eventId || params.registrationEventId,
    message: "Il posto è stato appena preso da un altro partecipante. Nessun problema: ti abbiamo rimborsato automaticamente.",
  };
};

export const finalizeMembershipCheckoutSession = async ({
  session,
  supabaseAdmin,
}: Omit<FinalizePaymentParams, "stripe">): Promise<PaymentFinalizerResult> => {
  const db = supabaseAdmin as SupabaseAdminClient;

  if (session.payment_status !== "paid") {
    return { success: false, eventId: session.metadata?.event_id || null, error: "Pagamento non ancora confermato" };
  }

  const userId = session.metadata?.user_id || null;
  if (!userId) throw new Error("Session missing user metadata");
  if (session.metadata?.type && session.metadata.type !== "membership") {
    throw new Error("Invalid membership session");
  }

  const { error: membershipError } = await db.rpc("activate_membership", {
    user_id_param: userId,
  });
  if (membershipError) {
    console.error("Membership activation error:", membershipError);
    throw new Error("Failed to activate membership");
  }

  const membershipFeeAmount = centsToEuros(
    Number(session.metadata?.membership_fee_cents || "0") || Number(session.amount_total || "0")
  );
  await recordUserPaymentTransaction(db, {
    user_id: userId,
    event_id: session.metadata?.event_id || null,
    kind: "payment",
    source: "membership_checkout",
    amount: membershipFeeAmount,
    membership_fee_amount: membershipFeeAmount,
    stripe_checkout_session_id: session.id || null,
    stripe_payment_intent_id: paymentIntentIdFromSession(session),
    metadata: {
      type: "membership",
    },
  });

  return { success: true, eventId: session.metadata?.event_id || null };
};

export const finalizeEventCheckoutSession = async ({
  session,
  stripe,
  supabaseAdmin,
}: FinalizePaymentParams): Promise<PaymentFinalizerResult> => {
  const db = supabaseAdmin as SupabaseAdminClient;

  if (session.payment_status !== "paid") {
    return { success: false, eventId: session.metadata?.event_id || null, error: "Pagamento non ancora confermato" };
  }

  const registrationId = session.metadata?.registration_id || null;
  const eventId = session.metadata?.event_id || null;
  const userId = session.metadata?.user_id || null;
  const membershipIncluded = session.metadata?.membership_included === "true";
  const bookingAmountCents = Number(session.metadata?.booking_amount_cents || "0");
  const checkoutKind = (session.metadata?.checkout_kind || "full") as CheckoutKind;
  const ledgerAmounts = ledgerAmountsFromEventSession(session);

  if (!registrationId) throw new Error("Registration ID not found in session");
  if (!userId) throw new Error("User not found in session");

  const stripePaymentIntentId = paymentIntentIdFromSession(session);

  const { data: reg, error: regError } = await db
    .from<EventRegistrationRow>("event_registrations")
    .select("id, status, payment_status, event_id, price_option_id, amount_paid, service_fee_amount, total_price_amount, deposit_amount, balance_due_amount")
    .eq("id", registrationId)
    .eq("user_id", userId)
    .single();

  if (regError || !reg) {
    if (stripePaymentIntentId && bookingAmountCents > 0) {
      try {
        await refundBookingAmount(stripe, stripePaymentIntentId, bookingAmountCents);
        await recordUserPaymentTransaction(db, {
          user_id: userId,
          event_id: eventId || null,
          kind: "refund",
          source: "event_checkout_auto_refund",
          amount: bookingAmountCents / 100,
          event_amount: bookingAmountCents / 100,
          stripe_checkout_session_id: session.id || null,
          stripe_payment_intent_id: stripePaymentIntentId,
          metadata: {
            reason: "missing_registration",
          },
        });
      } catch (error) {
        console.error("Refund error for missing registration:", error);
      }
    }
    return {
      success: false,
      eventId: eventId || null,
      error: "La registrazione non è più disponibile. Ti abbiamo rimborsato automaticamente.",
      auto_refunded: true,
    };
  }

  if (
    reg.payment_status === "paid" ||
    (checkoutKind === "deposit" && reg.payment_status === "deposit_paid")
  ) {
    await recordDiscountUsageFromSession(db, session, eventId || reg.event_id, userId);
    await recordUserPaymentTransaction(db, {
      user_id: userId,
      registration_id: registrationId,
      event_id: eventId || reg.event_id,
      kind: "payment",
      source: checkoutKind === "balance" ? "event_balance_checkout" : "event_checkout",
      amount: ledgerAmounts.amount,
      event_amount: ledgerAmounts.eventAmount,
      service_fee_amount: ledgerAmounts.serviceFeeAmount,
      membership_fee_amount: ledgerAmounts.membershipFeeAmount,
      stripe_checkout_session_id: session.id || null,
      stripe_payment_intent_id: stripePaymentIntentId,
      metadata: {
        checkout_kind: checkoutKind,
        booking_amount_cents: String(ledgerAmounts.bookingAmountCents),
        event_amount_cents: String(ledgerAmounts.eventAmountCents),
        service_fee_cents: String(ledgerAmounts.serviceFeeCents),
        membership_fee_cents: String(ledgerAmounts.membershipFeeCents),
      },
    });
    return { success: true, eventId: eventId || reg.event_id };
  }

  if (isCancelledRegistrationStatus(reg.status)) {
    if (stripePaymentIntentId && bookingAmountCents > 0) {
      try {
        await refundBookingAmount(stripe, stripePaymentIntentId, bookingAmountCents);
        await recordUserPaymentTransaction(db, {
          user_id: userId,
          registration_id: registrationId,
          event_id: eventId || reg.event_id,
          kind: "refund",
          source: "event_checkout_auto_refund",
          amount: bookingAmountCents / 100,
          event_amount: bookingAmountCents / 100,
          stripe_checkout_session_id: session.id || null,
          stripe_payment_intent_id: stripePaymentIntentId,
          metadata: {
            reason: "cancelled_registration",
          },
        });
      } catch (refundError) {
        console.error("Auto-refund error for cancelled registration:", refundError);
      }
    }

    await db
      .from("event_registrations")
      .update({
        payment_status: "refunded",
        stripe_payment_intent_id: stripePaymentIntentId,
        refund_percentage: 100,
        refund_amount: bookingAmountCents / 100,
        refund_status: "completed",
      })
      .eq("id", registrationId)
      .eq("user_id", userId);

    return {
      success: false,
      auto_refunded: true,
      eventId: eventId || reg.event_id,
      error: "La registrazione era stata annullata. Ti abbiamo rimborsato automaticamente.",
    };
  }

  const { data: event, error: eventError } = await db
    .from<EventRow>("events")
    .select("spots_total, spots_taken, status, title, date, time, duration")
    .eq("id", reg.event_id)
    .single();
  if (eventError || !event) throw new Error("Event not found");

  let spotsAvailable = Number(event.spots_total || 0) - Number(event.spots_taken || 0);
  let selectedOptionName = "";
  if (reg.price_option_id) {
    const { data: availabilityRows, error: availabilityError } = await db
      .rpc<AvailabilityRow[]>("get_event_option_availability", { p_event_id: reg.event_id });
    if (availabilityError) throw availabilityError;

    const availability = (availabilityRows || []).find((row) => row.option_id === reg.price_option_id);
    spotsAvailable = Number(availability?.real_remaining ?? 0);

    const { data: option } = await db
      .from<PriceOptionRow>("event_price_options")
      .select("name")
      .eq("id", reg.price_option_id)
      .maybeSingle();
    selectedOptionName = option?.name ? ` - ${option.name}` : "";
  }

  if (checkoutKind !== "balance" && (!acceptsRegistrationStatus(event.status) || isEventStarted(event) || spotsAvailable <= 0)) {
    return await refundSpotTakenRegistration(db, stripe, {
      session,
      registrationId,
      userId,
      eventId,
      registrationEventId: reg.event_id,
      eventTitle: event.title || "questo evento",
      selectedOptionName,
      stripePaymentIntentId,
      bookingAmountCents,
      membershipIncluded,
    });
  }

  const nextStatus = checkoutKind === "deposit" ? "deposit_paid" : "paid";
  const nextBalanceDueAmount = checkoutKind === "deposit"
    ? Math.max(0, Number(reg.total_price_amount || 0) - Number(reg.deposit_amount || 0))
    : 0;
  const registrationUpdate: Record<string, unknown> = {
    payment_status: nextStatus,
    status: nextStatus,
    stripe_payment_intent_id: stripePaymentIntentId,
    refund_status: "not_requested",
    balance_due_amount: nextBalanceDueAmount,
  };

  if (checkoutKind === "balance") {
    registrationUpdate.amount_paid = Number(reg.amount_paid || 0) + bookingAmountCents / 100;
  } else {
    registrationUpdate.amount_paid = bookingAmountCents / 100;
    registrationUpdate.service_fee_amount = Number(session.metadata?.service_fee_cents || "0") / 100;
  }

  await recordDiscountUsageFromSession(db, session, eventId || reg.event_id, userId);

  const { error: updateError } = await db
    .from("event_registrations")
    .update(registrationUpdate)
    .eq("id", registrationId)
    .eq("user_id", userId);
  if (updateError) {
    if (checkoutKind !== "balance" && isRegistrationCapacityError(updateError)) {
      return await refundSpotTakenRegistration(db, stripe, {
        session,
        registrationId,
        userId,
        eventId,
        registrationEventId: reg.event_id,
        eventTitle: event.title || "questo evento",
        selectedOptionName,
        stripePaymentIntentId,
        bookingAmountCents,
        membershipIncluded,
      });
    }
    console.error("Registration update error:", updateError);
    throw new Error("Failed to update registration");
  }

  await db.from("registration_payment_transactions").insert({
    registration_id: registrationId,
    event_id: eventId || reg.event_id,
    user_id: userId,
    kind: "payment",
    source: checkoutKind === "balance" ? "event_balance_checkout" : "event_checkout",
    amount: bookingAmountCents / 100,
    stripe_checkout_session_id: session.id || null,
    stripe_payment_intent_id: stripePaymentIntentId,
    metadata: {
      checkout_kind: checkoutKind,
      service_fee_cents: session.metadata?.service_fee_cents || "0",
    },
  });

  await recordUserPaymentTransaction(db, {
    user_id: userId,
    registration_id: registrationId,
    event_id: eventId || reg.event_id,
    kind: "payment",
    source: checkoutKind === "balance" ? "event_balance_checkout" : "event_checkout",
    amount: ledgerAmounts.amount,
    event_amount: ledgerAmounts.eventAmount,
    service_fee_amount: ledgerAmounts.serviceFeeAmount,
    membership_fee_amount: ledgerAmounts.membershipFeeAmount,
    stripe_checkout_session_id: session.id || null,
    stripe_payment_intent_id: stripePaymentIntentId,
    metadata: {
      checkout_kind: checkoutKind,
      booking_amount_cents: String(ledgerAmounts.bookingAmountCents),
      event_amount_cents: String(ledgerAmounts.eventAmountCents),
      service_fee_cents: String(ledgerAmounts.serviceFeeCents),
      membership_fee_cents: String(ledgerAmounts.membershipFeeCents),
    },
  });

  if (membershipIncluded) {
    const { error: membershipError } = await db.rpc("activate_membership", {
      user_id_param: userId,
    });
    if (membershipError) {
      console.error("Membership activation error:", membershipError);
    }
  }

  await db
    .from("event_registrations")
    .delete()
    .eq("event_id", reg.event_id)
    .eq("user_id", userId)
    .eq("payment_status", "pending")
    .neq("id", registrationId);

  return { success: true, eventId: eventId || null };
};

export const finalizeRegistrationChangeCheckoutSession = async ({
  session,
  supabaseAdmin,
}: Omit<FinalizePaymentParams, "stripe">): Promise<PaymentFinalizerResult> => {
  const db = supabaseAdmin as SupabaseAdminClient;

  if (session.payment_status !== "paid") {
    return { success: false, eventId: session.metadata?.event_id || null, error: "Pagamento non ancora confermato" };
  }

  const changeRequestId = session.metadata?.change_request_id || null;
  const userId = session.metadata?.user_id || null;
  const eventId = session.metadata?.event_id || null;
  if (!changeRequestId) throw new Error("Change request ID not found in session");
  if (!userId) throw new Error("User not found in session");

  const { data: changeRequest, error: changeError } = await db
    .from("registration_change_requests")
    .select("*")
    .eq("id", changeRequestId)
    .eq("user_id", userId)
    .single();
  if (changeError || !changeRequest) throw new Error("Change request not found");

  if ((changeRequest as Record<string, unknown>).status === "completed") {
    return { success: true, eventId: eventId || String((changeRequest as Record<string, unknown>).event_id || "") };
  }

  const stripePaymentIntentId = paymentIntentIdFromSession(session);
  await applyRegistrationChangeRequest(db as unknown as Parameters<typeof applyRegistrationChangeRequest>[0], changeRequest as Record<string, unknown>, {
    stripePaymentIntentId,
    stripeCheckoutSessionId: session.id || null,
  });

  return { success: true, eventId: eventId || String((changeRequest as Record<string, unknown>).event_id || "") };
};
