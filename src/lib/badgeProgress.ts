import {
  countUniqueAttendedEvents,
  dedupeRegistrationsByEvent,
  isAttendedRegistration,
  type EventRegistrationIdentity,
} from "@/lib/eventRegistrations";

type BadgeEventFilters = {
  min_difficulty?: number | string | null;
  max_difficulty?: number | string | null;
};

export type BadgeProgressDefinition = {
  required_events?: number | null;
  requirement_value?: number | null;
  requirement_type?: string | null;
  category?: string | null;
  event_filters?: BadgeEventFilters | null;
};

export type BadgeProgressRegistration = Omit<EventRegistrationIdentity, "events"> & {
  sport_level?: string | null;
  events?: {
    id?: string | null;
    date?: string | null;
    difficulty?: string | null;
    additional_fields?: Record<string, unknown> | null;
    event_categories?: { name?: string | null } | { name?: string | null }[] | null;
  } | null;
};

export type UserBadgeProgress = {
  completed?: boolean | null;
  progress?: number | null;
};

const NON_INFERABLE_REQUIREMENTS = new Set(["membership_first_150", "streak"]);

export const getBadgeTarget = (badge: BadgeProgressDefinition) =>
  Math.max(badge.required_events ?? badge.requirement_value ?? 1, 1);

export const resolveBadgeProgress = ({
  badge,
  userBadge,
  registrations,
}: {
  badge: BadgeProgressDefinition;
  userBadge?: UserBadgeProgress | null;
  registrations: BadgeProgressRegistration[];
}) => {
  const target = getBadgeTarget(badge);
  if (userBadge?.completed) return target;
  if (typeof userBadge?.progress === "number") return clampProgress(userBadge.progress, target);

  return clampProgress(inferBadgeProgress(badge, registrations), target);
};

export const countGenericAttendanceBadgeProgress = (registrations: BadgeProgressRegistration[]) =>
  countUniqueAttendedEvents(withoutManualRegistrations(registrations));

const inferBadgeProgress = (badge: BadgeProgressDefinition, registrations: BadgeProgressRegistration[]) => {
  const requirementType = normalizeRequirementType(badge.requirement_type);
  if (requirementType && NON_INFERABLE_REQUIREMENTS.has(requirementType)) return 0;

  const category = badge.category?.trim();
  if (normalizeText(category) === "special") return 0;

  if (
    category &&
    (!requirementType || requirementType === "events_attended" || requirementType === "category_events")
  ) {
    return countCategoryAttendanceBadgeProgress(registrations, category, badge.event_filters);
  }

  if (!category && (!requirementType || requirementType === "events_attended")) {
    return countGenericAttendanceBadgeProgress(registrations);
  }

  return 0;
};

const countCategoryAttendanceBadgeProgress = (
  registrations: BadgeProgressRegistration[],
  category: string,
  eventFilters: BadgeEventFilters | null | undefined
) =>
  dedupeRegistrationsByEvent(withoutManualRegistrations(registrations))
    .filter(isAttendedRegistration)
    .filter((registration) => eventMatchesCategory(registration.events, category))
    .filter((registration) => eventMatchesFilters(registration.events, eventFilters)).length;

const withoutManualRegistrations = (registrations: BadgeProgressRegistration[]) =>
  registrations.filter((registration) => !registration.sport_level?.startsWith("manual:"));

const eventMatchesCategory = (event: BadgeProgressRegistration["events"], category: string) => {
  const target = normalizeText(category);
  if (!event || !target) return false;

  return eventCategoryNames(event).some((name) => normalizeText(name) === target);
};

const eventCategoryNames = (event: NonNullable<BadgeProgressRegistration["events"]>) => {
  const relation = Array.isArray(event.event_categories) ? event.event_categories[0] : event.event_categories;
  const fields = event.additional_fields || {};
  const secondary = Array.isArray(fields.fit_score_secondary_categories)
    ? fields.fit_score_secondary_categories.filter((value): value is string => typeof value === "string")
    : [];

  return [relation?.name, fields.fit_score_main_category, ...secondary].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
};

const eventMatchesFilters = (
  event: BadgeProgressRegistration["events"],
  eventFilters: BadgeEventFilters | null | undefined
) => {
  const minimumDifficulty = integerFilter(eventFilters?.min_difficulty);
  if (minimumDifficulty !== null && (getDifficultyLevel(event?.difficulty) ?? 0) < minimumDifficulty) return false;

  const maximumDifficulty = integerFilter(eventFilters?.max_difficulty);
  if (maximumDifficulty !== null && (getDifficultyLevel(event?.difficulty) ?? 6) > maximumDifficulty) return false;

  return true;
};

const integerFilter = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
};

const getDifficultyLevel = (value: string | null | undefined) => {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) return numeric;

  const numericText = raw.match(/(^|[^0-9])([1-5])\s*\/\s*5([^0-9]|$)/)?.[2];
  if (numericText) return Number(numericText);

  const labels: Record<string, number> = {
    beginner: 1,
    easy: 1,
    facile: 1,
    introduzione: 1,
    "prima volta": 1,
    esploratore: 2,
    intermedio: 3,
    escursionista: 3,
    impegnativo: 4,
    intrepido: 4,
    advanced: 5,
    hard: 5,
    expert: 5,
    avanzato: 5,
  };

  return labels[raw] ?? null;
};

const normalizeRequirementType = (value: string | null | undefined) =>
  value?.trim().toLowerCase().replace(/-/g, "_") || null;

const normalizeText = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const clampProgress = (value: number, target: number) => Math.min(Math.max(value, 0), target);
