import { isWithinPromoWindow } from "@/lib/promoPricing";

export type PriceOptionPaymentType = "free" | "paid" | "deposit" | "location";
export type BalancePaymentMode = "online" | "on_site";

export interface PriceOptionLike {
  id?: string | null;
  name?: string | null;
  price?: number | string | null;
  sort_order?: number | null;
  original_price?: number | string | null;
  eligible_group?: string | null;
  is_promotional?: boolean | null;
  promo_start?: string | null;
  promo_end?: string | null;
  payment_type?: string | null;
  deposit_amount?: number | string | null;
  balance_amount?: number | string | null;
  balance_payment_mode?: string | null;
  has_dedicated_spots?: boolean | null;
  dedicated_spots?: number | null;
  spots_taken?: number | null;
  waitlist_enabled?: boolean | null;
}

export interface EventPricingLike {
  price?: number | string | null;
  deposit?: number | string | null;
  payment_type?: string | null;
  balance_payment_mode?: string | null;
  spots_total?: number | null;
  spots_taken?: number | null;
  status?: string | null;
  waiting_list_enabled?: boolean | null;
  additional_fields?: Record<string, unknown> | null;
}

const paymentTypes = new Set(["free", "paid", "deposit", "location"]);
export const LAST_SPOTS_FILL_RATIO = 0.7;
export const DEFAULT_PRICE_OPTION_DISPLAY_NAME = "Partecipazione evento";

export const isGeneratedPriceOptionName = (name: string | null | undefined) => {
  const cleanName = String(name ?? "").trim();
  return /^formula(?:\s+\d+)?$/i.test(cleanName);
};

export const getPriceOptionDisplayName = (
  option: PriceOptionLike | null | undefined,
  fallback = DEFAULT_PRICE_OPTION_DISPLAY_NAME,
) => {
  const cleanName = option?.name?.trim();
  return cleanName && !isGeneratedPriceOptionName(cleanName) ? cleanName : fallback;
};

export const toMoney = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizePaymentType = (
  value: string | null | undefined,
  fallback: PriceOptionPaymentType = "free",
): PriceOptionPaymentType =>
  paymentTypes.has(String(value)) ? (value as PriceOptionPaymentType) : fallback;

export const normalizeBalancePaymentMode = (
  value: string | null | undefined,
): BalancePaymentMode | null => {
  if (value === "on_site") return "on_site";
  if (value === "online") return "online";
  return null;
};

export const findPriceOptionById = <T extends PriceOptionLike>(
  options: T[] | null | undefined,
  optionId?: string | null,
) => {
  if (!optionId) return null;
  return (options || []).find((option) => option.id === optionId) || null;
};

export const getOptionPaymentType = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => {
  const eventPaymentType = normalizePaymentType(event.payment_type, "free");
  return normalizePaymentType(option?.payment_type, eventPaymentType);
};

export const isOnlinePaymentType = (paymentType: string | null | undefined) =>
  paymentType === "paid" || paymentType === "deposit";

export const getOptionTotalPrice = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => toMoney(option?.price ?? event.price);

export const getOptionDepositAmount = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => {
  if (getOptionPaymentType(option, event) !== "deposit") return 0;
  return toMoney(option?.deposit_amount ?? event.deposit);
};

export const getOptionBalanceAmount = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => {
  if (getOptionPaymentType(option, event) !== "deposit") return 0;
  const explicitBalance = option?.balance_amount;
  if (explicitBalance !== null && explicitBalance !== undefined) return Math.max(0, toMoney(explicitBalance));
  return Math.max(0, getOptionTotalPrice(option, event) - getOptionDepositAmount(option, event));
};

export const getOptionBalancePaymentMode = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
): BalancePaymentMode | null => {
  if (getOptionPaymentType(option, event) !== "deposit") return null;
  return normalizeBalancePaymentMode(option?.balance_payment_mode)
    ?? normalizeBalancePaymentMode(event.balance_payment_mode)
    ?? "online";
};

export const optionUsesDedicatedSpots = (option: PriceOptionLike | null | undefined) =>
  Boolean(option?.has_dedicated_spots && Number(option?.dedicated_spots || 0) > 0);

export const getEventRemainingSpots = (event: EventPricingLike) =>
  Math.max(0, Number(event.spots_total || 0) - Number(event.spots_taken || 0));

export const getEventFillRatio = (event: EventPricingLike) => {
  const total = Number(event.spots_total || 0);
  const taken = Number(event.spots_taken || 0);
  if (!Number.isFinite(total) || !Number.isFinite(taken) || total <= 0) return 0;
  return Math.min(1, Math.max(0, taken / total));
};

const closedStatuses = new Set(["closed", "cancelled", "past", "completed", "draft", "unpublished", "upcoming", "rescheduled"]);

export const isEventClosedForRegistration = (event: EventPricingLike) =>
  closedStatuses.has(String(event.status || ""));

export const isEventCapacitySoldOut = (event: EventPricingLike) =>
  Number(event.spots_total || 0) > 0 && getEventRemainingSpots(event) <= 0;

export const isEventManualSoldOut = (event: EventPricingLike) =>
  event.status === "full" && !isEventCapacitySoldOut(event);

export const isEventSoldOut = (event: EventPricingLike) =>
  event.status === "full" || isEventCapacitySoldOut(event);

export const shouldShowPublicCapacity = (event: EventPricingLike) =>
  !isEventManualSoldOut(event);

export const hasEventLastSpots = (event: EventPricingLike) =>
  Number(event.spots_total || 0) > 0
  && getEventFillRatio(event) >= LAST_SPOTS_FILL_RATIO
  && getEventRemainingSpots(event) > 0
  && !isEventSoldOut(event);

export const hasActivePromotionalPriceOption = (
  options: PriceOptionLike[] | null | undefined,
  now = new Date(),
) =>
  (options || []).some((option) =>
    Boolean(option.is_promotional) && isWithinPromoWindow(option.promo_start, option.promo_end, now)
  );

export const isWaitlistEnabledForEvent = (event: EventPricingLike) =>
  event.waiting_list_enabled === true
  || (event.additional_fields as any)?.waiting_list_enabled === true;

export const getOptionRemainingSpots = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => {
  const eventRemaining = getEventRemainingSpots(event);
  if (!optionUsesDedicatedSpots(option)) return eventRemaining;

  const dedicatedRemaining = Math.max(0, Number(option?.dedicated_spots || 0) - Number(option?.spots_taken || 0));
  return Math.min(eventRemaining, dedicatedRemaining);
};

export const isOptionBookable = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => {
  if (isEventClosedForRegistration(event) || isEventSoldOut(event)) return false;
  return getOptionRemainingSpots(option, event) > 0;
};

export const canOptionJoinWaitlist = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => {
  if (isEventClosedForRegistration(event)) return false;
  if (!isEventSoldOut(event) && getOptionRemainingSpots(option, event) > 0) return false;
  return !isOptionBookable(option, event) && isWaitlistEnabledForEvent(event);
};

export const getOptionAvailabilityLabel = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => {
  const remaining = getOptionRemainingSpots(option, event);
  if (remaining > 1) return `${remaining} posti disponibili`;
  if (remaining === 1) return "1 posto disponibile";
  return canOptionJoinWaitlist(option, event) ? "Lista d'attesa" : "Esaurita";
};

export const getOptionPaymentSummary = (
  option: PriceOptionLike | null | undefined,
  event: EventPricingLike,
) => {
  const paymentType = getOptionPaymentType(option, event);
  const total = getOptionTotalPrice(option, event);
  if (paymentType === "free") return "Gratis";
  if (paymentType === "location") return `€${total.toFixed(2)} sul posto`;
  if (paymentType === "deposit") {
    const deposit = getOptionDepositAmount(option, event);
    const balance = getOptionBalanceAmount(option, event);
    const mode = getOptionBalancePaymentMode(option, event) === "on_site" ? "sul posto" : "online";
    return `Acconto €${deposit.toFixed(2)} + saldo €${balance.toFixed(2)} ${mode}`;
  }
  return `€${total.toFixed(2)} online`;
};

export const getEligibilityLabel = (group: string | null | undefined) => {
  if (!group || group === "all") return "Tutti";
  if (group === "members") return "Soci";
  if (group === "new_users") return "Nuovi";
  if (group === "experienced") return "Esperti";
  if (group === "loyal") return "Fedeli";
  if (group.startsWith("badge:")) return "Badge";
  if (group.startsWith("trekking_gt:")) return `Trekking > ${group.split(":")[1] || "0"}`;
  if (group.startsWith("events_gt:")) return `Eventi > ${group.split(":")[1] || "0"}`;
  if (group.startsWith("user:") || group.startsWith("user_id:") || group.startsWith("profile:") || group.startsWith("assigned_user:")) {
    return "Utente specifico";
  }
  return group;
};
