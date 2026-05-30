import type { QuickFilterType } from "@/components/events/QuickFilters";
import type { EventWithDetails } from "@/hooks/useEvents";
import { parseEventDurationMinutes } from "@/lib/eventDates";
import { hasEventLastSpots } from "@/lib/priceOptions";

export const parseDurationHours = (duration: string | null | undefined) => {
  const minutes = parseEventDurationMinutes(duration);
  return minutes ? minutes / 60 : null;
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

export const matchesAllHomeQuickFilters = (event: EventWithDetails, filters: QuickFilterType[]) =>
  filters.every((filter) => matchesHomeQuickFilter(event, filter));
