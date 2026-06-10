import { recordUserPaymentTransaction } from "./user-payment-transactions.ts";
import type { StripeFeeDetails } from "./stripe-fees.ts";

export type PaymentType = "free" | "paid" | "deposit" | "location";
export type BalancePaymentMode = "online" | "on_site" | null;

export type RegistrationChangeQuote = {
  registrationId: string;
  eventId: string;
  userId: string;
  eventTitle: string;
  oldPriceOptionId: string | null;
  newPriceOptionId: string;
  oldPriceOptionName: string;
  newPriceOptionName: string;
  oldPaymentType: PaymentType;
  newPaymentType: PaymentType;
  oldTotalAmount: number;
  newTotalAmount: number;
  amountPaidBefore: number;
  serviceFeeAmount: number;
  eventPaidBefore: number;
  cashEventPaidBefore: number;
  discountCreditBefore: number;
  targetEventPaidAmount: number;
  additionalPaymentAmount: number;
  refundAmount: number;
  newAmountPaid: number;
  newBalanceDueAmount: number;
  newDepositAmount: number | null;
  newBalancePaymentMode: BalancePaymentMode;
  newPaymentStatus: string;
  newRegistrationStatus: string;
};

type QueryResponse<T = unknown> = {
  data?: T | null;
  error?: Error | null;
  count?: number | null;
};

type QueryBuilder = PromiseLike<QueryResponse> & {
  select: (columns?: string, options?: { count?: "exact"; head?: boolean }) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: readonly unknown[]) => QueryBuilder;
  update: (values: Record<string, unknown>) => QueryBuilder;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder;
  single: () => Promise<QueryResponse<Record<string, unknown>>>;
  maybeSingle: () => Promise<QueryResponse<Record<string, unknown>>>;
};

type SupabaseLike = {
  from: (table: string) => QueryBuilder;
};

const paymentTypes = new Set(["free", "paid", "deposit", "location"]);
const activeChangeStatuses = ["requires_payment", "processing"];
const activeRegistrationStatuses = ["registered", "paid", "deposit_paid"];
const activeParticipantStatuses = ["registered", "paid", "deposit_paid", "attended", "no_show"];

const money = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

export const cents = (value: number) => Math.round(money(value) * 100);

const normalizePaymentType = (value: unknown, fallback: PaymentType): PaymentType =>
  paymentTypes.has(String(value)) ? (value as PaymentType) : fallback;

const normalizeBalancePaymentMode = (value: unknown): BalancePaymentMode => {
  if (value === "online" || value === "on_site") return value;
  return null;
};

const resolvePaymentConfig = (event: Record<string, unknown>, option: Record<string, unknown> | null) => {
  const eventPaymentType = normalizePaymentType(event.payment_type, "free");
  const paymentType = normalizePaymentType(option?.payment_type, eventPaymentType);
  const totalAmount = paymentType === "free" ? 0 : money(option?.price ?? event.price);
  const depositAmount = paymentType === "deposit"
    ? Math.min(totalAmount, money(option?.deposit_amount ?? event.deposit))
    : 0;
  const balancePaymentMode = paymentType === "deposit"
    ? (normalizeBalancePaymentMode(option?.balance_payment_mode) ??
      normalizeBalancePaymentMode(event.balance_payment_mode) ??
      "online")
    : null;

  return {
    paymentType,
    totalAmount,
    depositAmount,
    balancePaymentMode,
    name: String(option?.name ?? "Partecipazione evento"),
  };
};

const eventHasStarted = (event: Record<string, unknown>) => {
  const date = String(event.date ?? "");
  const time = String(event.time ?? "00:00");
  if (!date) return true;
  const startsAt = new Date(`${date}T${time}`);
  return Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now();
};

const getTargetEventPaidAmount = (
  registration: Record<string, unknown>,
  oldPaymentType: PaymentType,
  newPaymentType: PaymentType,
  newTotalAmount: number,
  newDepositAmount: number,
  eventPaidBefore: number,
) => {
  const currentFullyPaid = registration.status === "paid" || registration.payment_status === "paid";
  if (newPaymentType === "free" || newPaymentType === "location") return 0;
  if (newPaymentType === "paid") return newTotalAmount;

  if (currentFullyPaid) return newTotalAmount;

  const minimumDeposit = Math.min(newTotalAmount, newDepositAmount);
  if (eventPaidBefore <= 0 || oldPaymentType === "free" || oldPaymentType === "location") {
    return minimumDeposit;
  }

  return Math.min(newTotalAmount, Math.max(eventPaidBefore, minimumDeposit));
};

const getNextStatuses = (
  paymentType: PaymentType,
  targetEventPaidAmount: number,
  newTotalAmount: number,
  newBalanceDueAmount: number,
) => {
  if (paymentType === "free") {
    return { paymentStatus: "not_required", registrationStatus: "registered" };
  }
  if (paymentType === "location") {
    return { paymentStatus: "pay_on_location", registrationStatus: "registered" };
  }
  if (paymentType === "deposit" && newBalanceDueAmount > 0) {
    return { paymentStatus: "deposit_paid", registrationStatus: "deposit_paid" };
  }
  if (targetEventPaidAmount >= newTotalAmount) {
    return { paymentStatus: "paid", registrationStatus: "paid" };
  }
  return { paymentStatus: "pending", registrationStatus: "pending_payment" };
};

const getDiscountCreditAmount = async (
  db: SupabaseLike,
  params: {
    eventId: string;
    userId: string;
  },
) => {
  const { data, error } = await db
    .from("discount_code_usage")
    .select("original_price, discounted_price")
    .eq("event_id", params.eventId)
    .eq("user_id", params.userId);
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return money(rows.reduce((total, row) => {
    if (!row || typeof row !== "object") return total;
    const usage = row as Record<string, unknown>;
    return total + Math.max(0, money(usage.original_price) - money(usage.discounted_price));
  }, 0));
};

export const buildRegistrationChangeQuote = async (
  db: SupabaseLike,
  params: {
    registrationId: string;
    eventId: string;
    userId: string;
    newPriceOptionId: string;
  },
): Promise<RegistrationChangeQuote> => {
  const { data: registration, error: registrationError } = await db
    .from("event_registrations")
    .select("id, event_id, user_id, status, payment_status, price_option_id, amount_paid, service_fee_amount, total_price_amount, balance_due_amount, sport_level")
    .eq("id", params.registrationId)
    .eq("event_id", params.eventId)
    .eq("user_id", params.userId)
    .single();

  if (registrationError || !registration) throw new Error("Registrazione non trovata.");
  if (String(registration.sport_level || "").startsWith("manual:")) {
    throw new Error("Le iscrizioni manuali non possono cambiare formula.");
  }
  if (!activeRegistrationStatuses.includes(String(registration.status || ""))) {
    throw new Error("Questa iscrizione non puo cambiare formula in questo stato.");
  }
  if (String(registration.payment_status || "") === "pending") {
    throw new Error("Completa prima il pagamento in sospeso.");
  }
  if (registration.price_option_id === params.newPriceOptionId) {
    throw new Error("Hai gia selezionato questa formula.");
  }

  const { data: event, error: eventError } = await db
    .from("events")
    .select("id, title, date, time, price, deposit, payment_type, balance_payment_mode")
    .eq("id", params.eventId)
    .single();
  if (eventError || !event) throw new Error("Evento non trovato.");
  if (eventHasStarted(event)) {
    throw new Error("Non e piu possibile cambiare formula dopo l'inizio dell'evento.");
  }

  let oldOption: Record<string, unknown> | null = null;
  if (registration.price_option_id) {
    const { data, error } = await db
      .from("event_price_options")
      .select("id, event_id, name, price, payment_type, deposit_amount, balance_amount, balance_payment_mode")
      .eq("id", registration.price_option_id)
      .eq("event_id", params.eventId)
      .maybeSingle();
    if (error) throw error;
    oldOption = data || null;
  }

  const { data: newOption, error: optionError } = await db
    .from("event_price_options")
    .select("id, event_id, name, price, payment_type, deposit_amount, balance_amount, balance_payment_mode, has_dedicated_spots, dedicated_spots")
    .eq("id", params.newPriceOptionId)
    .eq("event_id", params.eventId)
    .single();
  if (optionError || !newOption) throw new Error("Formula non trovata.");

  if (newOption.has_dedicated_spots && Number(newOption.dedicated_spots || 0) > 0) {
    const { count, error } = await db
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("price_option_id", params.newPriceOptionId)
      .in("status", activeParticipantStatuses)
      .neq("payment_status", "pending");
    if (error) throw error;
    const currentCount = Number(count || 0);
    if (currentCount >= Number(newOption.dedicated_spots || 0)) {
      throw new Error("Questa formula non ha piu posti dedicati disponibili.");
    }
  }

  const oldConfig = resolvePaymentConfig(event, oldOption);
  const newConfig = resolvePaymentConfig(event, newOption);
  const amountPaidBefore = money(registration.amount_paid);
  const serviceFeeAmount = money(registration.service_fee_amount);
  const cashEventPaidBefore = Math.max(0, money(amountPaidBefore - serviceFeeAmount));
  const oldTotalAmount = money(registration.total_price_amount) > 0
    ? money(registration.total_price_amount)
    : oldConfig.totalAmount;
  const discountCreditBefore = Math.min(
    oldTotalAmount,
    await getDiscountCreditAmount(db, { eventId: params.eventId, userId: params.userId }),
  );
  const eventPaidBefore = Math.min(oldTotalAmount, money(cashEventPaidBefore + discountCreditBefore));
  const targetEventPaidAmount = getTargetEventPaidAmount(
    registration,
    oldConfig.paymentType,
    newConfig.paymentType,
    newConfig.totalAmount,
    newConfig.depositAmount,
    eventPaidBefore,
  );
  const additionalPaymentAmount = Math.max(0, money(targetEventPaidAmount - eventPaidBefore));
  const refundAmount = Math.min(
    cashEventPaidBefore,
    Math.max(0, money(eventPaidBefore - targetEventPaidAmount)),
  );
  const newBalanceDueAmount = newConfig.paymentType === "deposit"
    ? Math.max(0, money(newConfig.totalAmount - targetEventPaidAmount))
    : 0;
  const statuses = getNextStatuses(
    newConfig.paymentType,
    targetEventPaidAmount,
    newConfig.totalAmount,
    newBalanceDueAmount,
  );
  const newCashEventPaidAmount = Math.max(
    0,
    money(cashEventPaidBefore - refundAmount + additionalPaymentAmount),
  );
  const newAmountPaid = newCashEventPaidAmount > 0 ? money(newCashEventPaidAmount + serviceFeeAmount) : 0;

  return {
    registrationId: params.registrationId,
    eventId: params.eventId,
    userId: params.userId,
    eventTitle: String(event.title || "Evento"),
    oldPriceOptionId: registration.price_option_id ? String(registration.price_option_id) : null,
    newPriceOptionId: params.newPriceOptionId,
    oldPriceOptionName: oldConfig.name,
    newPriceOptionName: String(newOption.name || "Partecipazione evento"),
    oldPaymentType: oldConfig.paymentType,
    newPaymentType: newConfig.paymentType,
    oldTotalAmount,
    newTotalAmount: newConfig.totalAmount,
    amountPaidBefore,
    serviceFeeAmount,
    eventPaidBefore,
    cashEventPaidBefore,
    discountCreditBefore,
    targetEventPaidAmount,
    additionalPaymentAmount,
    refundAmount,
    newAmountPaid,
    newBalanceDueAmount,
    newDepositAmount: newConfig.paymentType === "deposit" ? newConfig.depositAmount : null,
    newBalancePaymentMode: newConfig.balancePaymentMode,
    newPaymentStatus: statuses.paymentStatus,
    newRegistrationStatus: statuses.registrationStatus,
  };
};

export const quoteToRequestRow = (quote: RegistrationChangeQuote, status: string) => ({
  registration_id: quote.registrationId,
  event_id: quote.eventId,
  user_id: quote.userId,
  old_price_option_id: quote.oldPriceOptionId,
  new_price_option_id: quote.newPriceOptionId,
  old_payment_type: quote.oldPaymentType,
  new_payment_type: quote.newPaymentType,
  old_total_amount: quote.oldTotalAmount,
  new_total_amount: quote.newTotalAmount,
  amount_paid_before: quote.amountPaidBefore,
  service_fee_amount: quote.serviceFeeAmount,
  event_paid_before: quote.eventPaidBefore,
  target_event_paid_amount: quote.targetEventPaidAmount,
  additional_payment_amount: quote.additionalPaymentAmount,
  refund_amount: quote.refundAmount,
  new_amount_paid: quote.newAmountPaid,
  new_balance_due_amount: quote.newBalanceDueAmount,
  new_deposit_amount: quote.newDepositAmount,
  new_balance_payment_mode: quote.newBalancePaymentMode,
  new_payment_status: quote.newPaymentStatus,
  new_registration_status: quote.newRegistrationStatus,
  status,
  metadata: {
    old_price_option_name: quote.oldPriceOptionName,
    new_price_option_name: quote.newPriceOptionName,
    cash_event_paid_before: quote.cashEventPaidBefore,
    discount_credit_before: quote.discountCreditBefore,
  },
});

export const applyRegistrationChangeRequest = async (
  db: SupabaseLike,
  changeRequest: Record<string, unknown>,
  params: {
    stripePaymentIntentId?: string | null;
    stripeRefundId?: string | null;
    stripeCheckoutSessionId?: string | null;
    stripeFeeDetails?: StripeFeeDetails | null;
  } = {},
) => {
  const requestId = String(changeRequest.id);
  const refundAmount = money(changeRequest.refund_amount);
  const additionalPaymentAmount = money(changeRequest.additional_payment_amount);
  const newPaymentType = String(changeRequest.new_payment_type);
  const updateValues: Record<string, unknown> = {
    price_option_id: changeRequest.new_price_option_id,
    amount_paid: money(changeRequest.new_amount_paid),
    payment_status: changeRequest.new_payment_status,
    status: changeRequest.new_registration_status,
    total_price_amount: newPaymentType === "deposit" ? money(changeRequest.new_total_amount) : null,
    deposit_amount: newPaymentType === "deposit" ? changeRequest.new_deposit_amount : null,
    balance_due_amount: newPaymentType === "deposit" ? money(changeRequest.new_balance_due_amount) : null,
    balance_payment_mode: newPaymentType === "deposit" ? changeRequest.new_balance_payment_mode : null,
    refund_amount: refundAmount > 0 ? refundAmount : 0,
    refund_percentage: 0,
    refund_status: refundAmount > 0 ? "completed" : "not_requested",
  };

  if (params.stripePaymentIntentId) {
    updateValues.stripe_payment_intent_id = params.stripePaymentIntentId;
  }

  const { error: updateError } = await db
    .from("event_registrations")
    .update(updateValues)
    .eq("id", changeRequest.registration_id)
    .eq("user_id", changeRequest.user_id);
  if (updateError) throw updateError;

  if (additionalPaymentAmount > 0) {
    await db.from("registration_payment_transactions").insert({
      registration_id: changeRequest.registration_id,
      event_id: changeRequest.event_id,
      user_id: changeRequest.user_id,
      change_request_id: requestId,
      kind: "payment",
      source: "registration_change",
      amount: additionalPaymentAmount,
      stripe_checkout_session_id: params.stripeCheckoutSessionId || changeRequest.stripe_checkout_session_id || null,
      stripe_payment_intent_id: params.stripePaymentIntentId || null,
    });

    await recordUserPaymentTransaction(db, {
      registration_id: String(changeRequest.registration_id),
      event_id: String(changeRequest.event_id),
      user_id: String(changeRequest.user_id),
      kind: "payment",
      source: "registration_change",
      amount: additionalPaymentAmount,
      event_amount: additionalPaymentAmount,
      stripe_checkout_session_id: params.stripeCheckoutSessionId || String(changeRequest.stripe_checkout_session_id || "") || null,
      stripe_payment_intent_id: params.stripePaymentIntentId || null,
      ...(params.stripeFeeDetails || {}),
      metadata: {
        change_request_id: requestId,
      },
    });
  }

  if (refundAmount > 0) {
    await db.from("registration_payment_transactions").insert({
      registration_id: changeRequest.registration_id,
      event_id: changeRequest.event_id,
      user_id: changeRequest.user_id,
      change_request_id: requestId,
      kind: "refund",
      source: "registration_change",
      amount: refundAmount,
      stripe_refund_id: params.stripeRefundId || null,
    });

    await recordUserPaymentTransaction(db, {
      registration_id: String(changeRequest.registration_id),
      event_id: String(changeRequest.event_id),
      user_id: String(changeRequest.user_id),
      kind: "refund",
      source: "registration_change",
      amount: refundAmount,
      event_amount: refundAmount,
      stripe_refund_id: params.stripeRefundId || null,
      metadata: {
        change_request_id: requestId,
      },
    });
  }

  const { error: requestError } = await db
    .from("registration_change_requests")
    .update({
      status: "completed",
      stripe_payment_intent_id: params.stripePaymentIntentId || changeRequest.stripe_payment_intent_id || null,
      stripe_refund_id: params.stripeRefundId || changeRequest.stripe_refund_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (requestError) throw requestError;

  await db.from("notifications").insert({
    user_id: changeRequest.user_id,
    type: "price_option_changed",
    title: "Formula iscrizione aggiornata",
    message: "La formula della tua iscrizione e stata aggiornata correttamente.",
    event_id: changeRequest.event_id,
  });
};

export const cancelActiveRegistrationChanges = async (
  db: SupabaseLike,
  registrationId: string,
  userId: string,
) => {
  await db
    .from("registration_change_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("registration_id", registrationId)
    .eq("user_id", userId)
    .in("status", activeChangeStatuses);
};
