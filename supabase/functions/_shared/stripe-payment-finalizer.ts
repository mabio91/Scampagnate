type CheckoutKind = "full" | "deposit" | "balance";

type StripeSessionLike = {
  payment_status?: string | null;
  payment_intent?: string | { id?: string | null } | null;
  metadata?: Record<string, string | undefined> | null;
};

type StripeRefundsClient = {
  refunds: {
    create: (params: { payment_intent: string; amount?: number }) => Promise<unknown>;
  };
};

type SupabaseResult<T> = { data: T | null; error: unknown };

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

const paymentIntentIdFromSession = (session: StripeSessionLike) => {
  const paymentIntent = session.payment_intent;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id || null;
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
        await stripe.refunds.create({ payment_intent: stripePaymentIntentId, amount: bookingAmountCents });
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
    return { success: true, eventId: eventId || null };
  }

  const { data: event, error: eventError } = await db
    .from<EventRow>("events")
    .select("spots_total, spots_taken, status, title")
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

  if (checkoutKind !== "balance" && (!acceptsRegistrationStatus(event.status) || spotsAvailable <= 0)) {
    if (stripePaymentIntentId && bookingAmountCents > 0) {
      try {
        await stripe.refunds.create({ payment_intent: stripePaymentIntentId, amount: bookingAmountCents });
        console.log(`Auto-refunded payment ${stripePaymentIntentId} - spot taken by another user`);
      } catch (refundError) {
        console.error("Auto-refund error:", refundError);
      }
    }

    await db
      .from("event_registrations")
      .update({
        payment_status: "refunded",
        status: "waitlist",
        stripe_payment_intent_id: stripePaymentIntentId,
        refund_percentage: 100,
        refund_amount: bookingAmountCents / 100,
        refund_status: "completed",
      })
      .eq("id", registrationId)
      .eq("user_id", userId);

    await db.from("notifications").insert({
      user_id: userId,
      type: "waitlist_spot_lost",
      title: "Posto non confermato",
      message: `Il posto per "${event.title || "questo evento"}${selectedOptionName}" è stato appena preso da un altro partecipante. Nessun problema: ti abbiamo rimborsato automaticamente. Resti in lista d'attesa.`,
      event_id: reg.event_id,
    });

    if (membershipIncluded) {
      await db.rpc("activate_membership", { user_id_param: userId });
    }

    return {
      success: false,
      spot_taken: true,
      auto_refunded: true,
      eventId: eventId || null,
      message: "Il posto è stato appena preso da un altro partecipante. Nessun problema: ti abbiamo rimborsato automaticamente.",
    };
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

  const { error: updateError } = await db
    .from("event_registrations")
    .update(registrationUpdate)
    .eq("id", registrationId)
    .eq("user_id", userId);
  if (updateError) {
    console.error("Registration update error:", updateError);
    throw new Error("Failed to update registration");
  }

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
