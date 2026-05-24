type SupabaseInsertResult = { data?: unknown; error?: unknown };

type SupabaseQueryBuilder = {
  insert: (values: Record<string, unknown>) => PromiseLike<SupabaseInsertResult>;
};

type SupabaseLedgerClient = {
  from: (table: string) => SupabaseQueryBuilder;
};

type PaymentTransactionInput = {
  user_id: string;
  registration_id?: string | null;
  event_id?: string | null;
  kind: "payment" | "refund";
  source: string;
  amount: number;
  event_amount?: number;
  service_fee_amount?: number;
  membership_fee_amount?: number;
  currency?: string;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_refund_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

const toMoney = (value: unknown) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100) / 100;
};

const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";

export const centsToEuros = (value: unknown) => {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.round(cents) / 100;
};

export const recordUserPaymentTransaction = async (
  db: SupabaseLedgerClient,
  input: PaymentTransactionInput,
) => {
  if (!input.user_id || toMoney(input.amount) <= 0) return;

  const row = {
    user_id: input.user_id,
    registration_id: input.registration_id || null,
    event_id: input.event_id || null,
    kind: input.kind,
    source: input.source,
    amount: toMoney(input.amount),
    event_amount: toMoney(input.event_amount),
    service_fee_amount: toMoney(input.service_fee_amount),
    membership_fee_amount: toMoney(input.membership_fee_amount),
    currency: input.currency || "eur",
    stripe_checkout_session_id: input.stripe_checkout_session_id || null,
    stripe_payment_intent_id: input.stripe_payment_intent_id || null,
    stripe_refund_id: input.stripe_refund_id || null,
    metadata: input.metadata || {},
    ...(input.created_at ? { created_at: input.created_at } : {}),
  };

  try {
    const { error } = await db.from("user_payment_transactions").insert(row);
    if (!error) return;
    if (errorCode(error) === "23505") return;
    console.error("Payment ledger insert failed:", error);
  } catch (error) {
    console.error("Payment ledger insert failed:", error);
  }
};
