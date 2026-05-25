import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { PLATFORM_TIMEZONE } from "@/lib/timezone";

type PromoBoundary = "start" | "end";
export type PromoWindowStatus = "active" | "upcoming" | "expired";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const LEGACY_UTC_MIDNIGHT_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?$/;

const getDateOnlyValue = (value: string) => {
  const trimmed = value.trim();
  if (DATE_ONLY_PATTERN.test(trimmed)) return trimmed;
  return trimmed.match(LEGACY_UTC_MIDNIGHT_PATTERN)?.[1] || null;
};

const getBoundaryTime = (boundary: PromoBoundary) =>
  boundary === "end" ? "23:59:59.999" : "00:00:00.000";

export const promoDateInputToIso = (
  value: string | null | undefined,
  boundary: PromoBoundary,
) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return fromZonedTime(`${trimmed}T${getBoundaryTime(boundary)}`, PLATFORM_TIMEZONE).toISOString();
  }

  if (LOCAL_DATE_TIME_PATTERN.test(trimmed)) {
    return fromZonedTime(trimmed, PLATFORM_TIMEZONE).toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const formatPromoDateInput = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  const dateOnly = getDateOnlyValue(trimmed);
  if (dateOnly) return dateOnly;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";

  return formatInTimeZone(parsed, PLATFORM_TIMEZONE, "yyyy-MM-dd");
};

export const parsePromoBoundaryDate = (
  value: string | null | undefined,
  boundary: PromoBoundary,
) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const dateOnly = getDateOnlyValue(trimmed);
  if (dateOnly) {
    return fromZonedTime(`${dateOnly}T${getBoundaryTime(boundary)}`, PLATFORM_TIMEZONE);
  }

  if (LOCAL_DATE_TIME_PATTERN.test(trimmed)) {
    return fromZonedTime(trimmed, PLATFORM_TIMEZONE);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getPromoWindowStatus = (
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): PromoWindowStatus => {
  const startsAt = parsePromoBoundaryDate(start, "start");
  if (startsAt && startsAt > now) return "upcoming";

  const endsAt = parsePromoBoundaryDate(end, "end");
  if (endsAt && endsAt < now) return "expired";

  return "active";
};

export const isWithinPromoWindow = (
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
) => getPromoWindowStatus(start, end, now) === "active";

export const isPromoExpired = (
  end: string | null | undefined,
  now = new Date(),
) => getPromoWindowStatus(null, end, now) === "expired";

export const formatPromoCountdownLabel = (
  end: string | null | undefined,
  now = new Date(),
) => {
  const endsAt = parsePromoBoundaryDate(end, "end");
  if (!endsAt) return null;

  const diffMs = endsAt.getTime() - now.getTime();
  if (diffMs <= 0) return "Promo scaduta";

  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60_000));

  if (totalMinutes >= 1_440) {
    const days = Math.floor(totalMinutes / 1_440);
    const hours = Math.floor((totalMinutes % 1_440) / 60);
    return hours > 0 ? `scade tra ${days}g ${hours}h` : `scade tra ${days}g`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `scade tra ${hours}h ${minutes}m` : `scade tra ${hours}h`;
  }

  return `scade tra ${totalMinutes}m`;
};

export const getPromoBadgeLabel = (
  end: string | null | undefined,
  now = new Date(),
) => {
  const countdownLabel = formatPromoCountdownLabel(end, now);
  if (!countdownLabel) return "Promo";
  if (countdownLabel === "Promo scaduta") return countdownLabel;
  return `Promo · ${countdownLabel}`;
};
