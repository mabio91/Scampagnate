import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AccessRulesConfig } from "@/hooks/useEventAccessRules";

// Numeric mappings (shared with useEventAccessRules)
const LEVEL_MAP: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const EXPERIENCE_MAP: Record<string, number> = {
  "0_2": 1,
  "3_5": 2,
  "5_plus": 3,
  "5+": 3,
};

const FREQUENCY_MAP: Record<string, number> = {
  low: 1,
  "0-1/week": 1,
  medium: 2,
  "1-2/week": 2,
  high: 3,
  ">2/week": 3,
};

export interface FitScoreBreakdown {
  level: number | null;
  experience: number | null;
  activity: number | null;
  interests: number | null;
}

export interface FitScoreResult {
  score: number;
  breakdown: FitScoreBreakdown;
  label: "alta" | "media" | "bassa";
  labelDisplay: string;
  color: "green" | "amber" | "red";
  reasons: { icon: "check" | "warning"; text: string }[];
  profileIncomplete: boolean;
  hidden: boolean; // true if event has no relevant rules
}

/**
 * Calculates an Event Fit Score (0-100) based on how well a user's profile
 * matches the event's access rules and category.
 *
 * The score is computed client-side for real-time reactivity (profile changes,
 * event rule changes). It uses only data already available in the AuthContext
 * and event object — no extra queries needed.
 */
export const useEventFitScore = (
  accessRules: AccessRulesConfig | null | undefined,
  event: {
    difficulty?: string | null;
    category?: { name: string } | null;
  } | null
): FitScoreResult => {
  const { profile } = useAuth();

  return useMemo(() => {
    const HIDDEN: FitScoreResult = {
      score: 0,
      breakdown: { level: null, experience: null, activity: null, interests: null },
      label: "media",
      labelDisplay: "",
      color: "amber",
      reasons: [],
      profileIncomplete: false,
      hidden: true,
    };

    if (!event) return HIDDEN;

    // Determine which scoring components are relevant based on event rules
    const rules = accessRules?.rules || [];

    const hasLevelRule = rules.some(r => r.type === "min_level") || !!event.difficulty;
    const hasExperienceRule = rules.some(r =>
      r.type === "min_experience" || r.type === "min_trekking_events" ||
      r.type === "min_attended_events" || r.type === "min_activities"
    );
    const hasActivityRule = rules.some(r => r.type === "min_activity_frequency");
    const hasInterestsRule = rules.some(r => r.type === "interests");

    // If no relevant rules at all, hide the score
    if (!hasLevelRule && !hasExperienceRule && !hasActivityRule && !hasInterestsRule) {
      return HIDDEN;
    }

    // Check profile completeness
    if (!profile) {
      return {
        ...HIDDEN,
        hidden: false,
        profileIncomplete: true,
      };
    }

    const profileFields = [profile.self_level, profile.trekking_experience, profile.activity_frequency];
    const filledFields = profileFields.filter(Boolean).length;
    if (filledFields < 2) {
      return {
        ...HIDDEN,
        hidden: false,
        profileIncomplete: true,
      };
    }

    // Calculate each component
    const breakdown: FitScoreBreakdown = { level: null, experience: null, activity: null, interests: null };
    const reasons: FitScoreResult["reasons"] = [];
    const weights: { key: keyof FitScoreBreakdown; weight: number }[] = [];

    // 1. Level match (35%)
    if (hasLevelRule) {
      const levelRule = rules.find(r => r.type === "min_level");
      // Map difficulty (1-5 scale) to the same 1-3 tier as self_level
      const rawRequired = levelRule ? Number(levelRule.value) || 1 : (parseInt(event.difficulty || "0") || 0);
      // Difficulty 1-2 → tier 1 (beginner), 3 → tier 2 (intermediate), 4-5 → tier 3 (advanced)
      const requiredLevel = rawRequired <= 0 ? 0 : rawRequired <= 2 ? 1 : rawRequired <= 3 ? 2 : 3;

      if (requiredLevel > 0) {
        const userLevel = LEVEL_MAP[profile.self_level || ""] || 0;
        let score: number;
        const diff = userLevel - requiredLevel;

        if (diff >= 0) {
          score = 100;
          reasons.push({ icon: "check", text: "Livello adeguato" });
        } else if (diff === -1) {
          score = 60;
          reasons.push({ icon: "warning", text: "Livello leggermente inferiore" });
        } else {
          score = 20;
          reasons.push({ icon: "warning", text: "Livello significativamente inferiore" });
        }
        breakdown.level = score;
        weights.push({ key: "level", weight: 35 });
      }
    }

    // 2. Experience count (20%)
    if (hasExperienceRule) {
      const expRule = rules.find(r => r.type === "min_experience");
      const requiredExp = expRule ? Number(expRule.value) || 1 : 1;
      const userExp = EXPERIENCE_MAP[profile.trekking_experience || ""] || 0;

      let score: number;
      const diff = userExp - requiredExp;
      if (diff >= 0) {
        score = 100;
        reasons.push({ icon: "check", text: "Esperienza sufficiente" });
      } else if (diff === -1) {
        score = 70;
        reasons.push({ icon: "warning", text: "Esperienza leggermente inferiore" });
      } else {
        score = 30;
        reasons.push({ icon: "warning", text: "Esperienza insufficiente" });
      }
      breakdown.experience = score;
      weights.push({ key: "experience", weight: 20 });
    }

    // 3. Activity frequency (20%)
    if (hasActivityRule) {
      const freqRule = rules.find(r => r.type === "min_activity_frequency");
      const requiredFreq = freqRule ? Number(freqRule.value) || 1 : 1;
      const userFreq = FREQUENCY_MAP[profile.activity_frequency || ""] || 0;

      let score: number;
      const diff = userFreq - requiredFreq;
      if (diff >= 0) {
        score = 100;
        reasons.push({ icon: "check", text: "Attività fisica adeguata" });
      } else if (diff === -1) {
        score = 70;
        reasons.push({ icon: "warning", text: "Attività fisica non frequente" });
      } else {
        score = 40;
        reasons.push({ icon: "warning", text: "Attività fisica insufficiente" });
      }
      breakdown.activity = score;
      weights.push({ key: "activity", weight: 20 });
    }

    // 4. Interests match (25%)
    if (hasInterestsRule) {
      const interestsRule = rules.find(r => r.type === "interests");
      const eventInterests = interestsRule?.interests || [];
      const userInterests = profile.interests || [];

      if (eventInterests.length > 0 && userInterests.length > 0) {
        const matching = eventInterests.filter((i: string) => userInterests.includes(i)).length;
        const maxLen = Math.max(userInterests.length, eventInterests.length);
        const score = Math.round((matching / maxLen) * 100);
        breakdown.interests = score;

        if (score >= 70) {
          reasons.push({ icon: "check", text: "Interessi in linea" });
        } else if (score >= 40) {
          reasons.push({ icon: "warning", text: "Interessi parzialmente in linea" });
        } else {
          reasons.push({ icon: "warning", text: "Interessi poco in linea" });
        }
        weights.push({ key: "interests", weight: 25 });
      }
    }

    // If no weights were populated (edge case), hide
    if (weights.length === 0) return HIDDEN;

    // Normalize weights to sum to 100
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const finalScore = Math.round(
      weights.reduce((sum, w) => {
        const componentScore = breakdown[w.key] || 0;
        return sum + componentScore * (w.weight / totalWeight);
      }, 0)
    );

    const label: FitScoreResult["label"] =
      finalScore >= 80 ? "alta" : finalScore >= 50 ? "media" : "bassa";

    const labelDisplay =
      finalScore >= 80
        ? "Ottima compatibilità"
        : finalScore >= 50
          ? "Buona compatibilità"
          : "Bassa compatibilità";

    const color: FitScoreResult["color"] =
      finalScore >= 80 ? "green" : finalScore >= 50 ? "amber" : "red";

    return {
      score: finalScore,
      breakdown,
      label,
      labelDisplay,
      color,
      reasons,
      profileIncomplete: false,
      hidden: false,
    };
  }, [profile, accessRules, event]);
};
