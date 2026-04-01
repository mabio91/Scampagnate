import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AccessRulesConfig } from "@/hooks/useEventAccessRules";
import {
  CATEGORY_INTEREST_AFFINITY,
  CATEGORY_GOAL_AFFINITY,
} from "@/lib/fitScoreAffinityTables";

// ── Numeric mappings ──────────────────────────────────────────────

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

// ── Weight configuration ──────────────────────────────────────────

const BASE_WEIGHTS = {
  level: 40,
  activity: 25,
  experience: 20,
  interests: 10,
  goal: 5,
} as const;

type ComponentKey = keyof typeof BASE_WEIGHTS;

// ── Scoring curves ────────────────────────────────────────────────

function scoreDiff(
  diff: number,
  curves: { gte1: number; eq0: number; eqm1: number; ltem2: number }
): number {
  if (diff >= 1) return curves.gte1;
  if (diff === 0) return curves.eq0;
  if (diff === -1) return curves.eqm1;
  return curves.ltem2;
}

// ── Public types ──────────────────────────────────────────────────

export interface FitScoreBreakdown {
  level: number | null;
  experience: number | null;
  activity: number | null;
  interests: number | null;
  goal: number | null;
}

export type FitState = "high" | "medium" | "low_medium" | "low";

export interface FitReason {
  icon: "check" | "warning";
  text: string;
  component: ComponentKey;
}

export interface FitScoreResult {
  score: number;
  breakdown: FitScoreBreakdown;
  state: FitState;
  label: string; // e.g. "Perfetto", "Ci sta — ma preparati"
  color: "green" | "amber" | "red";
  reasons: FitReason[];
  profileIncomplete: boolean;
  hidden: boolean;
}

// ── Main hook ─────────────────────────────────────────────────────

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
      breakdown: { level: null, experience: null, activity: null, interests: null, goal: null },
      state: "medium",
      label: "",
      color: "amber",
      reasons: [],
      profileIncomplete: false,
      hidden: true,
    };

    if (!event) return HIDDEN;

    // Determine which scoring components are relevant
    const rules = accessRules?.rules || [];
    const hasLevelRule = rules.some((r) => r.type === "min_level") || !!event.difficulty;
    const hasExperienceRule = rules.some(
      (r) =>
        r.type === "min_experience" ||
        r.type === "min_trekking_events" ||
        r.type === "min_attended_events" ||
        r.type === "min_activities"
    );
    const hasActivityRule = rules.some((r) => r.type === "min_activity_frequency");

    // Interests & goal are available if we have a category
    const categoryName = event.category?.name || "";
    const hasCategory = !!CATEGORY_INTEREST_AFFINITY[categoryName];

    // If nothing relevant at all, hide
    if (!hasLevelRule && !hasExperienceRule && !hasActivityRule && !hasCategory) {
      return HIDDEN;
    }

    // Profile check
    if (!profile) {
      return { ...HIDDEN, hidden: false, profileIncomplete: true };
    }

    const profileFields = [
      profile.self_level,
      profile.trekking_experience,
      profile.activity_frequency,
    ];
    if (profileFields.filter(Boolean).length < 2) {
      return { ...HIDDEN, hidden: false, profileIncomplete: true };
    }

    // ── Calculate each component ──────────────────────────────────

    const components: { key: ComponentKey; score: number }[] = [];
    const reasons: FitReason[] = [];
    const breakdown: FitScoreBreakdown = {
      level: null,
      experience: null,
      activity: null,
      interests: null,
      goal: null,
    };

    // 1) Level (40%)
    if (hasLevelRule) {
      const levelRule = rules.find((r) => r.type === "min_level");
      const rawRequired = levelRule
        ? Number(levelRule.value) || 1
        : parseInt(event.difficulty || "0") || 0;
      // Map difficulty 1-5 to tier 1-3
      const requiredLevel =
        rawRequired <= 0 ? 0 : rawRequired <= 2 ? 1 : rawRequired <= 3 ? 2 : 3;

      if (requiredLevel > 0) {
        const userLevel = LEVEL_MAP[profile.self_level || ""] || 0;
        const diff = userLevel - requiredLevel;
        const s = scoreDiff(diff, { gte1: 1.0, eq0: 0.85, eqm1: 0.6, ltem2: 0.3 });
        breakdown.level = Math.round(s * 100);
        components.push({ key: "level", score: s });

        if (s >= 0.85) reasons.push({ icon: "check", text: "Sei al livello giusto", component: "level" });
        else if (s >= 0.6) reasons.push({ icon: "warning", text: "Questo evento è leggermente sopra il tuo livello attuale", component: "level" });
        else reasons.push({ icon: "warning", text: "Questo evento è sopra il tuo livello attuale", component: "level" });
      }
    }

    // 2) Activity frequency (25%)
    if (hasActivityRule) {
      const freqRule = rules.find((r) => r.type === "min_activity_frequency");
      const requiredFreq = freqRule ? Number(freqRule.value) || 1 : 1;
      const userFreq = FREQUENCY_MAP[profile.activity_frequency || ""] || 0;
      const diff = userFreq - requiredFreq;
      const s = scoreDiff(diff, { gte1: 1.0, eq0: 0.8, eqm1: 0.6, ltem2: 0.35 });
      breakdown.activity = Math.round(s * 100);
      components.push({ key: "activity", score: s });

      if (s >= 0.8) reasons.push({ icon: "check", text: "Il tuo ritmo di attività è in linea", component: "activity" });
      else if (s >= 0.6) reasons.push({ icon: "warning", text: "Allenamento un po' basso per questo evento", component: "activity" });
      else reasons.push({ icon: "warning", text: "Potresti faticare durante l'evento", component: "activity" });
    }

    // 3) Experience (20%)
    if (hasExperienceRule) {
      const expRule = rules.find((r) => r.type === "min_experience");
      const requiredExp = expRule ? Number(expRule.value) || 1 : 1;
      const userExp = EXPERIENCE_MAP[profile.trekking_experience || ""] || 0;
      const diff = userExp - requiredExp;
      const s = scoreDiff(diff, { gte1: 1.0, eq0: 0.85, eqm1: 0.65, ltem2: 0.4 });
      breakdown.experience = Math.round(s * 100);
      components.push({ key: "experience", score: s });

      if (s >= 0.85) reasons.push({ icon: "check", text: "Hai già esperienza simile", component: "experience" });
      else if (s >= 0.65) reasons.push({ icon: "warning", text: "Hai meno esperienza di quella consigliata", component: "experience" });
      else reasons.push({ icon: "warning", text: "Potresti trovare impegnativa la durata o il ritmo", component: "experience" });
    }

    // 4) Interests (10%)
    if (hasCategory) {
      const userInterests: string[] = profile.interests || [];
      const affinityTable = CATEGORY_INTEREST_AFFINITY[categoryName];
      if (userInterests.length > 0 && affinityTable) {
        const scores = userInterests.map((i) => affinityTable[i] ?? 0);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        breakdown.interests = Math.round(avg * 100);
        components.push({ key: "interests", score: avg });

        if (avg >= 0.7) reasons.push({ icon: "check", text: "In linea con quello che ti piace", component: "interests" });
        else if (avg >= 0.4) reasons.push({ icon: "warning", text: "Solo in parte in linea con i tuoi interessi", component: "interests" });
        else reasons.push({ icon: "warning", text: "Non è molto in linea con quello che ti piace di solito", component: "interests" });
      }
    }

    // 5) Goal (5%)
    if (hasCategory) {
      const userGoal = (profile as any).event_motivation as string | null;
      const goalTable = CATEGORY_GOAL_AFFINITY[categoryName];
      if (userGoal && goalTable) {
        const s = goalTable[userGoal] ?? 0.5;
        breakdown.goal = Math.round(s * 100);
        components.push({ key: "goal", score: s });

        if (s >= 0.7) reasons.push({ icon: "check", text: "In linea con quello che cerchi", component: "goal" });
        else if (s >= 0.4) reasons.push({ icon: "warning", text: "Solo in parte in linea con quello che cerchi", component: "goal" });
        else reasons.push({ icon: "warning", text: "Potrebbe non offrirti il tipo di esperienza che stai cercando", component: "goal" });
      }
    }

    // If no components were calculated, hide
    if (components.length === 0) return HIDDEN;

    // ── Normalize weights & compute final score ───────────────────

    const totalWeight = components.reduce((s, c) => s + BASE_WEIGHTS[c.key], 0);
    const finalScore = Math.round(
      components.reduce((sum, c) => {
        return sum + c.score * (BASE_WEIGHTS[c.key] / totalWeight);
      }, 0) * 100
    );

    // ── State & label ─────────────────────────────────────────────

    let state: FitState;
    let label: string;
    let color: FitScoreResult["color"];

    if (finalScore >= 70) {
      state = "high";
      label = "Perfetto";
      color = "green";
    } else if (finalScore >= 50) {
      state = "medium";
      label = "Ci sta — ma preparati";
      color = "amber";
    } else if (finalScore >= 30) {
      state = "low_medium";
      label = "Valuta bene";
      color = "amber";
    } else {
      state = "low";
      label = "Potrebbe essere tosto";
      color = "red";
    }

    return {
      score: finalScore,
      breakdown,
      state,
      label,
      color,
      reasons,
      profileIncomplete: false,
      hidden: false,
    };
  }, [profile, accessRules, event]);
};
