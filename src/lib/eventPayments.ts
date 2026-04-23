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

export const getEventBalancePaymentMode = (event: {
  payment_type?: string | null;
  balance_payment_mode?: string | null;
}) => {
  if (event.payment_type !== "deposit") return null;
  return event.balance_payment_mode === "on_site" ? "on_site" : "online";
};

export const getDepositAmount = (event: {
  payment_type?: string | null;
  deposit?: number | null;
  price?: number | null;
}) => {
  if (event.payment_type !== "deposit") return 0;
  return Number(event.deposit || 0);
};

export const getRemainingBalanceAmount = (event: {
  payment_type?: string | null;
  deposit?: number | null;
  price?: number | null;
}) => {
  if (event.payment_type !== "deposit") return 0;
  return Math.max(0, Number(event.price || 0) - Number(event.deposit || 0));
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
  event?: {
    payment_type?: string | null;
  } | null,
) => {
  const isPaymentEvent = event?.payment_type === "paid" || event?.payment_type === "deposit";
  if (!isPaymentEvent) return false;
  if (registration.status === "pending_payment") return true;
  return registration.status === "registered" && registration.payment_status === "pending";
};

export const isActiveParticipantRegistration = (registration: {
  status?: string | null;
}) => ACTIVE_PARTICIPANT_STATUSES.includes((registration.status || "") as never);

export const getDepositPaymentLabel = (
  registration: {
    status?: string | null;
    payment_status?: string | null;
  },
  event: {
    payment_type?: string | null;
    balance_payment_mode?: string | null;
  },
) => {
  if (!isDepositRegistration(registration)) return null;
  return getEventBalancePaymentMode(event) === "on_site"
    ? "Acconto pagato - saldo sul posto"
    : "Acconto pagato - saldo da completare";
};
