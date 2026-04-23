import { calculateEventFitScore, getInterestScore, getLevelScore } from "@/hooks/useEventFitScore";
import {
  CATEGORY_INTEREST_AFFINITY,
  getInterestCategoryLabel,
  normalizeInterestCategory,
} from "@/lib/fitScoreAffinityTables";
import { UI_LABELS } from "@/lib/labels";
import type { EventWithDetails } from "@/hooks/useEvents";

export interface RecommendationProfileInput {
  interests?: string[] | null;
  self_level?: string | null;
}

export interface RecommendationHistoryInput {
  registeredEventIds?: Set<string>;
  joinedCategoryCounts?: Record<string, number>;
  joinedEventCount?: number;
}

export interface PersonalizedRecommendation {
  event: EventWithDetails;
  score: number;
  whyText: string;
}

const getEventCategories = (event: EventWithDetails) => {
  const additionalFields = (event.additional_fields as Record<string, unknown> | null) || {};
  const mainCategory =
    typeof additionalFields.fit_score_main_category === "string"
      ? additionalFields.fit_score_main_category
      : event.category?.name || null;
  const secondaryCategories = Array.isArray(additionalFields.fit_score_secondary_categories)
    ? additionalFields.fit_score_secondary_categories.filter(
        (value): value is string => typeof value === "string"
      )
    : [];

  return [mainCategory, ...secondaryCategories]
    .map((category) => normalizeInterestCategory(category))
    .filter((category): category is string => !!category);
};

const getBestInterestMatch = (
  interests: string[],
  eventCategories: string[]
) => {
  let bestScore = 0;
  let bestInterest: string | null = null;

  for (const interest of interests) {
    const normalizedInterest = normalizeInterestCategory(interest);
    if (!normalizedInterest) continue;

    for (const eventCategory of eventCategories) {
      const score = CATEGORY_INTEREST_AFFINITY[eventCategory]?.[normalizedInterest] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestInterest = normalizedInterest;
      }
    }
  }

  return { score: bestScore, interest: bestInterest };
};

const buildReasonText = ({
  eventCategories,
  profileInterests,
  joinedCategoryCounts,
  levelScore,
}: {
  eventCategories: string[];
  profileInterests: string[];
  joinedCategoryCounts: Record<string, number>;
  levelScore: number | null;
}) => {
  const historyCategory = eventCategories
    .map((category) => ({ category, count: joinedCategoryCounts[category] || 0 }))
    .sort((a, b) => b.count - a.count)[0];

  if (historyCategory?.count > 0) {
    return UI_LABELS.recommendedBecauseJoined;
  }

  const bestInterestMatch = getBestInterestMatch(profileInterests, eventCategories);
  if (bestInterestMatch.score >= 50 && bestInterestMatch.interest) {
    return UI_LABELS.recommendedBecauseInterest(
      getInterestCategoryLabel(bestInterestMatch.interest) || bestInterestMatch.interest
    );
  }

  if (levelScore !== null && levelScore >= 60) {
    return UI_LABELS.recommendedBecauseLevel;
  }

  const firstCategory = eventCategories[0];
  if (firstCategory) {
    return UI_LABELS.recommendedBecauseCategory(
      getInterestCategoryLabel(firstCategory) || firstCategory
    );
  }

  return UI_LABELS.recommendedBecauseProfile;
};

export const getPersonalizedRecommendations = ({
  events,
  profile,
  history,
}: {
  events: EventWithDetails[];
  profile: RecommendationProfileInput | null | undefined;
  history: RecommendationHistoryInput | null | undefined;
}): PersonalizedRecommendation[] => {
  if (!profile) return [];

  const profileInterests = (profile.interests || [])
    .map((interest) => normalizeInterestCategory(interest))
    .filter((interest): interest is string => !!interest);
  const joinedCategoryCounts = history?.joinedCategoryCounts || {};
  const joinedEventCount = history?.joinedEventCount || 0;
  const registeredEventIds = history?.registeredEventIds || new Set<string>();
  const maxJoinedCategoryCount = Math.max(0, ...Object.values(joinedCategoryCounts));

  return events
    .filter((event) => !registeredEventIds.has(event.id))
    .map((event) => {
      const eventCategories = getEventCategories(event);
      const fitScore = calculateEventFitScore(profile, {
        difficulty: event.difficulty,
        category: eventCategories[0] ? { name: eventCategories[0] } : null,
        secondaryCategories: eventCategories.slice(1),
      });
      const interestScore = getInterestScore(profileInterests, eventCategories) ?? 0;
      const levelScore = getLevelScore(profile.self_level, event.difficulty);
      const historyScore =
        joinedEventCount > 0 && maxJoinedCategoryCount > 0
          ? Math.max(
              ...eventCategories.map(
                (category) => ((joinedCategoryCounts[category] || 0) / maxJoinedCategoryCount) * 100
              ),
              0
            )
          : 0;
      const exactPreferenceScore = eventCategories.some((category) => profileInterests.includes(category))
        ? 100
        : 0;

      const weightedSignals = [
        { value: fitScore.hidden ? 0 : fitScore.score, weight: 4 },
        { value: interestScore, weight: 3.5 },
        { value: historyScore, weight: joinedEventCount > 0 ? 3.5 : 0 },
        { value: exactPreferenceScore, weight: 2 },
        { value: levelScore ?? 0, weight: levelScore !== null ? 2.5 : 0 },
      ].filter((signal) => signal.weight > 0 && signal.value > 0);

      const personalizationStrength = weightedSignals.reduce(
        (sum, signal) => sum + signal.value * signal.weight,
        0
      );
      const totalWeight = weightedSignals.reduce((sum, signal) => sum + signal.weight, 0);
      const score = totalWeight > 0 ? Math.round(personalizationStrength / totalWeight) : 0;

      return {
        event,
        score,
        whyText: buildReasonText({
          eventCategories,
          profileInterests,
          joinedCategoryCounts,
          levelScore,
        }),
      };
    })
    .filter((item) => item.score >= 45)
    .sort((a, b) => b.score - a.score || new Date(a.event.date).getTime() - new Date(b.event.date).getTime())
    .slice(0, 6);
};

