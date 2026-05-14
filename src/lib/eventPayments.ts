import {
  getOptionBalanceAmount,
  getOptionBalancePaymentMode,
  getOptionDepositAmount,
  getOptionPaymentType,
  type EventPricingLike,
  type PriceOptionLike,
} from "@/lib/priceOptions";

export type BalancePaymentMode = "online" | "on_site";

export const ACTIVE_PARTICIPANT_STATUSES = [
  "registered",
  "deposit_paid",
  "paid",
  "attended",
  "no_show",
] as const;

export const ORGANIZER_VISIBLE_STATUSES = [
  ...ACTIVE_PARTICIPANT_STATUSES,
  "waitlist",
  "pending_approval",
] as const;

export const getEventBalancePaymentMode = (
  event: EventPricingLike,
  priceOption?: PriceOptionLike | null,
) => {
  return getOptionBalancePaymentMode(priceOption, event);
};

export const getDepositAmount = (
  event: EventPricingLike,
  priceOption?: PriceOptionLike | null,
) => {
  return getOptionDepositAmount(priceOption, event);
};

export const getRemainingBalanceAmount = (
  event: EventPricingLike,
  priceOption?: PriceOptionLike | null,
) => {
  return getOptionBalanceAmount(priceOption, event);
};

export const isDepositRegistration = (registration: {
  status?: string | null;
  payment_status?: string | null;
}) =>
  registration.status === "deposit_paid" || registration.payment_status === "deposit_paid";

export const isFullyPaidRegistration = (registration: {
  status?: string | null;
  payment_status?: string | null;
}) =>
  registration.status === "paid" || registration.payment_status === "paid";

export const isPendingPaymentRegistration = (
  registration: {
    status?: string | null;
    payment_status?: string | null;
  },
  event?: EventPricingLike | null,
  priceOption?: PriceOptionLike | null,
) => {
  const paymentType = event ? getOptionPaymentType(priceOption, event) : null;
  const isPaymentEvent = paymentType === "paid" || paymentType === "deposit";
  if (!isPaymentEvent) return false;
  if (registration.status === "pending_payment") return true;
  return registration.status === "registered" && registration.payment_status === "pending";
};

export const isActiveParticipantRegistration = (registration: {
  status?: string | null;
  payment_status?: string | null;
}) =>
  ACTIVE_PARTICIPANT_STATUSES.includes((registration.status || "") as never) &&
  registration.payment_status !== "pending";

export const getDepositPaymentLabel = (
  registration: {
    status?: string | null;
    payment_status?: string | null;
  },
  event: EventPricingLike,
  priceOption?: PriceOptionLike | null,
) => {
  if (!isDepositRegistration(registration)) return null;
  return getEventBalancePaymentMode(event, priceOption) === "on_site"
    ? "Acconto pagato - saldo sul posto"
    : "Acconto pagato - saldo da completare";
};
