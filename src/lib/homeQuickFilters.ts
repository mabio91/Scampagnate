import type { QuickFilterType } from "@/components/events/QuickFilters";
import type { EventWithDetails } from "@/hooks/useEvents";
import { hasEventLastSpots } from "@/lib/priceOptions";

const parseLocalizedNumber = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseDurationHours = (duration: string | null | undefined) => {
  if (!duration) return null;

  const lower = duration.trim().toLowerCase();
  if (!lower) return null;

  const days = parseLocalizedNumber(lower.match(/(\d+(?:[,.]\d+)?)\s*(?:giorn(?:o|i)?|gg|g|days?|d)\b/i)?.[1]) || 0;
  const hours = parseLocalizedNumber(lower.match(/(\d+(?:[,.]\d+)?)\s*(?:h|ore?|hours?)\b/i)?.[1]) || 0;
  const minutes = parseLocalizedNumber(lower.match(/(\d+(?:[,.]\d+)?)\s*(?:m|min|mins|minuti?)\b/i)?.[1]) || 0;
  const total = days * 24 + hours + minutes / 60;

  return total > 0 ? total : null;
};

export const getDifficultyLevel = (difficulty: string | null | undefined) => {
  const raw = difficulty?.trim().toLowerCase();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) return numeric;

  const namedLevels: Record<string, number> = {
    beginner: 1,
    easy: 1,
    facile: 1,
    introduzione: 1,
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

  return namedLevels[raw] || null;
};

const hasLastSpots = (event: EventWithDetails) => {
  return hasEventLastSpots(event);
};

export const matchesHomeQuickFilter = (event: EventWithDetails, filter: QuickFilterType) => {
  const difficultyLevel = getDifficultyLevel(event.difficulty);

  switch (filter) {
    case "lastSpots":
      return hasLastSpots(event);
    case "weekendAway":
      return (parseDurationHours(event.duration) || 0) > 24;
    case "easy":
      return difficultyLevel === 1 || difficultyLevel === 2;
    case "intermediate":
      return difficultyLevel === 3;
    case "challenging":
      return difficultyLevel === 4 || difficultyLevel === 5;
  }
};
