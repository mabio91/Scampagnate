export type StripeFeeDetails = {
  stripe_fee_amount: number;
  stripe_net_amount: number | null;
  stripe_balance_transaction_id: string | null;
};

type StripeBalanceTransactionLike = {
  id?: string | null;
  fee?: number | null;
  net?: number | null;
};

type StripeChargeLike = {
  id?: string | null;
  balance_transaction?: string | StripeBalanceTransactionLike | null;
};

type StripePaymentIntentLike = {
  id?: string | null;
  latest_charge?: string | StripeChargeLike | null;
};

export type StripeFeeLookupClient = {
  paymentIntents?: {
    retrieve: (
      id: string,
      params?: { expand?: string[] },
    ) => Promise<StripePaymentIntentLike>;
  };
  charges?: {
    retrieve: (
      id: string,
      params?: { expand?: string[] },
    ) => Promise<StripeChargeLike>;
  };
};

const centsToMoney = (value: unknown) => {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
};

const feeDetailsFromBalanceTransaction = (
  balanceTransaction: string | StripeBalanceTransactionLike | null | undefined,
): StripeFeeDetails | null => {
  if (!balanceTransaction || typeof balanceTransaction === "string") return null;

  return {
    stripe_fee_amount: centsToMoney(balanceTransaction.fee),
    stripe_net_amount: balanceTransaction.net == null ? null : centsToMoney(balanceTransaction.net),
    stripe_balance_transaction_id: balanceTransaction.id || null,
  };
};

export const lookupStripeFeeDetails = async (
  stripe: StripeFeeLookupClient,
  paymentIntentId: string | null | undefined,
): Promise<StripeFeeDetails | null> => {
  if (!paymentIntentId || !stripe.paymentIntents?.retrieve) return null;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });

    const latestCharge = paymentIntent.latest_charge;
    if (latestCharge && typeof latestCharge !== "string") {
      const expanded = feeDetailsFromBalanceTransaction(latestCharge.balance_transaction);
      if (expanded) return expanded;
    }

    if (typeof latestCharge === "string" && stripe.charges?.retrieve) {
      const charge = await stripe.charges.retrieve(latestCharge, {
        expand: ["balance_transaction"],
      });
      return feeDetailsFromBalanceTransaction(charge.balance_transaction);
    }
  } catch (error) {
    console.warn("Stripe fee lookup failed:", {
      paymentIntentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
};
