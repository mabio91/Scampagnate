import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AccessRulesConfig } from "@/hooks/useEventAccessRules";
import {
  CATEGORY_INTEREST_AFFINITY,
  FIT_SCORE_INTEREST_MIN,
  normalizeInterestCategory,
} from "@/lib/fitScoreAffinityTables";

const LEVEL_MAP: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export interface FitScoreBreakdown {
  level: number | null;
  interests: number | null;
}

export type FitState = "high" | "medium" | "low_medium" | "low";

export interface FitReason {
  icon: "check" | "warning";
  text: string;
  component: keyof FitScoreBreakdown;
}

export interface FitScoreResult {
  score: number;
  breakdown: FitScoreBreakdown;
  componentWeights: FitScoreBreakdown;
  state: FitState;
  label: string;
  color: "green" | "amber" | "red";
  reasons: FitReason[];
  profileIncomplete: boolean;
  hidden: boolean;
}

export interface FitScoreProfileInput {
  interests?: string[] | null;
  self_level?: string | null;
}

export interface FitScoreEventInput {
  difficulty?: string | null;
  category?: { name: string } | null;
  secondaryCategories?: string[] | null;
}

const EMPTY_BREAKDOWN: FitScoreBreakdown = {
  level: null,
  interests: null,
};

const EMPTY_RESULT: FitScoreResult = {
  score: 0,
  breakdown: EMPTY_BREAKDOWN,
  componentWeights: EMPTY_BREAKDOWN,
  state: "medium",
  label: "",
  color: "amber",
  reasons: [],
  profileIncomplete: false,
  hidden: true,
};

export const getLevelScore = (userLevelValue: string | null | undefined, eventDifficulty: string | null | undefined) => {
  const rawRequiredLevel = Number.parseInt(eventDifficulty || "", 10);
  const userLevel = LEVEL_MAP[userLevelValue || ""];
  const requiredLevel =
    rawRequiredLevel <= 0
      ? 0
      : rawRequiredLevel <= 2
        ? 1
        : rawRequiredLevel <= 3
          ? 2
          : 3;

  if (!requiredLevel) return null;
  if (!userLevel) return null;

  const diff = userLevel - requiredLevel;
  if (diff >= 0) return 100;
  if (diff === -1) return 60;
  return 20;
};

export const getInterestScore = (
  rawUserInterests: string[] | null | undefined,
  rawEventCategories: Array<string | null | undefined>
) => {
  const userInterests = (rawUserInterests || [])
    .map((interest) => normalizeInterestCategory(interest))
    .filter((interest): interest is string => !!interest);

  const eventCategories = rawEventCategories
    .map((category) => normalizeInterestCategory(category))
    .filter((category): category is string => !!category);

  if (userInterests.length === 0 || eventCategories.length === 0) return null;

  let bestScore = 0;

  for (const eventCategory of eventCategories) {
    const affinityRow = CATEGORY_INTEREST_AFFINITY[eventCategory];
    if (!affinityRow) continue;

    for (const userInterest of userInterests) {
      bestScore = Math.max(bestScore, affinityRow[userInterest] ?? 0);
    }
  }

  return bestScore;
};

const getStateFromScore = (
  score: number
): Pick<FitScoreResult, "state" | "label" | "color"> => {
  if (score >= 80) {
    return { state: "high", label: "Perfetto", color: "green" };
  }
  if (score >= 60) {
    return { state: "medium", label: "Buon match", color: "green" };
  }
  if (score >= 40) {
    return { state: "low_medium", label: "Così così", color: "amber" };
  }
  return { state: "low", label: "Poco adatto", color: "red" };
};

export const calculateEventFitScore = (
  profile: FitScoreProfileInput | null | undefined,
  event: FitScoreEventInput | null
): FitScoreResult => {
  if (!event) return EMPTY_RESULT;

  const eventCategories = [
    event.category?.name || null,
    ...(event.secondaryCategories || []),
  ].filter(Boolean) as string[];
  const hasDifficulty = !!event.difficulty;
  const hasCategoryData = eventCategories.some((category) => !!normalizeInterestCategory(category));

  if (!hasDifficulty && !hasCategoryData) {
    return EMPTY_RESULT;
  }

  if (!profile) {
    return { ...EMPTY_RESULT, hidden: false, profileIncomplete: true };
  }

  const userInterests = profile.interests || [];
  if (userInterests.length < FIT_SCORE_INTEREST_MIN) {
    return { ...EMPTY_RESULT, hidden: false, profileIncomplete: true };
  }

  if (hasDifficulty && !profile.self_level) {
    return { ...EMPTY_RESULT, hidden: false, profileIncomplete: true };
  }

  const interestsScore = getInterestScore(userInterests, eventCategories);
  const levelScore = getLevelScore(profile.self_level, event.difficulty);

  if (!hasDifficulty && interestsScore === null) {
    return EMPTY_RESULT;
  }

  const breakdown: FitScoreBreakdown = {
    level: hasDifficulty ? levelScore : null,
    interests: interestsScore,
  };

  const componentWeights: FitScoreBreakdown = hasDifficulty
    ? { level: 70, interests: 30 }
    : { level: null, interests: 100 };

  const score = hasDifficulty
    ? Math.round(((levelScore ?? 0) * 0.7) + ((interestsScore ?? 0) * 0.3))
    : interestsScore ?? 0;

  const reasons: FitReason[] = [];

  if (hasDifficulty && levelScore !== null) {
    if (levelScore === 100) {
      reasons.push({ icon: "check", text: "Il livello richiesto è in linea con il tuo profilo.", component: "level" });
    } else if (levelScore === 60) {
      reasons.push({ icon: "warning", text: "L'evento è un gradino sopra il tuo livello attuale.", component: "level" });
    } else {
      reasons.push({ icon: "warning", text: "L'evento richiede un livello più alto del tuo.", component: "level" });
    }
  }

  if (interestsScore !== null) {
    if (interestsScore >= 75) {
      reasons.push({ icon: "check", text: "Le categorie dell'evento combaciano bene con i tuoi interessi.", component: "interests" });
    } else if (interestsScore >= 50) {
      reasons.push({ icon: "check", text: "L'evento è abbastanza vicino a ciò che ti piace fare.", component: "interests" });
    } else if (interestsScore >= 25) {
      reasons.push({ icon: "warning", text: "L'affinità con i tuoi interessi è solo parziale.", component: "interests" });
    } else {
      reasons.push({ icon: "warning", text: "Le categorie dell'evento sono lontane dai tuoi interessi abituali.", component: "interests" });
    }
  }

  return {
    score,
    breakdown,
    componentWeights,
    reasons,
    profileIncomplete: false,
    hidden: false,
    ...getStateFromScore(score),
  };
};

export const useEventFitScore = (
  _accessRules: AccessRulesConfig | null | undefined,
  event: FitScoreEventInput | null
): FitScoreResult => {
  const { profile } = useAuth();

  return useMemo(
    () =>
      calculateEventFitScore(
        profile
          ? {
              interests: (profile.interests as string[] | null | undefined) || [],
              self_level: profile.self_level,
            }
          : null,
        event
      ),
    [event, profile]
  );
};
