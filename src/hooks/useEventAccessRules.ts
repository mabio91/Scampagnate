import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive as isMembershipActiveFn } from "@/lib/membership";

export interface AccessRule {
  type:
    | "min_trekking_events"
    | "min_activities"
    | "require_badge"
    | "require_membership"
    | "manual_approval"
    | "min_attended_events"
    | "min_level"
    | "min_experience"
    | "min_activity_frequency"
    | "interests";
  value?: number | string;
  badge_id?: string;
  badge_name?: string;
  message?: string;
  enforcement?: "hard" | "soft"; // hard = blocking, soft = advisory only
  interests?: string[]; // for interests rule
}

export interface AccessRulesConfig {
  rules: AccessRule[];
  restriction_message?: string;
  exclusivity_label?: string;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  failedRules: { rule: AccessRule; reason: string }[];
  softWarnings: { rule: AccessRule; reason: string }[];
  requiresApproval: boolean;
  restrictionMessage: string | null;
}

// Self-level numeric mapping
const LEVEL_MAP: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

// Experience numeric mapping
const EXPERIENCE_MAP: Record<string, number> = {
  "0_2": 1,
  "3_5": 2,
  "5_plus": 3,
  "5+": 3,
};

// Activity frequency numeric mapping
const FREQUENCY_MAP: Record<string, number> = {
  low: 1,
  "0-1/week": 1,
  medium: 2,
  "1-2/week": 2,
  high: 3,
  ">2/week": 3,
};

const LEVEL_LABELS: Record<string, string> = {
  "1": "Principiante",
  "2": "Intermedio",
  "3": "Avanzato",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  "1": "0-2 escursioni",
  "2": "3-5 escursioni",
  "3": "5+ escursioni",
};

const FREQUENCY_LABELS: Record<string, string> = {
  "1": "Bassa (0-1/settimana)",
  "2": "Media (1-2/settimana)",
  "3": "Alta (>2/settimana)",
};

export const useCheckEventAccessRules = (
  accessRules: AccessRulesConfig | null | undefined,
  difficulty: string | null
) => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ["check-access-rules", accessRules, difficulty, user?.id],
    queryFn: async (): Promise<AccessCheckResult> => {
      // No rules = open access
      if (!accessRules || !accessRules.rules || accessRules.rules.length === 0) {
        // Fallback to difficulty-based check if no explicit rules
        if (difficulty) {
          return checkDifficultyAccess(difficulty, user?.id || null, profile);
        }
        return { hasAccess: true, failedRules: [], softWarnings: [], requiresApproval: false, restrictionMessage: null };
      }

      if (!user || !profile) {
        return {
          hasAccess: false,
          failedRules: accessRules.rules
            .filter(r => getEffectiveEnforcement(r) === "hard")
            .map(r => ({ rule: r, reason: "Devi effettuare il login" })),
          softWarnings: [],
          requiresApproval: false,
          restrictionMessage: accessRules.restriction_message || "Devi effettuare il login per verificare i requisiti di accesso.",
        };
      }

      const failedRules: { rule: AccessRule; reason: string }[] = [];
      const softWarnings: { rule: AccessRule; reason: string }[] = [];
      let requiresApproval = false;

      for (const rule of accessRules.rules) {
        const enforcement = getEffectiveEnforcement(rule);
        const target = enforcement === "soft" ? softWarnings : failedRules;

        switch (rule.type) {
          case "require_membership": {
            if (!isMembershipActiveFn(profile)) {
              target.push({
                rule,
                reason: rule.message || "Questo evento richiede una membership attiva.",
              });
            }
            break;
          }

          case "min_trekking_events": {
            const minCount = Number(rule.value) || 1;
            const { data: pastEvents } = await supabase
              .from("event_registrations")
              .select("id, events!inner(category_id, event_categories(name))")
              .eq("user_id", user.id)
              .eq("checked_in", true)
              .in("status", ["registered", "paid"]);

            const trekkingCount = (pastEvents || []).filter((r: any) => {
              const catName = r.events?.event_categories?.name?.toLowerCase() || "";
              return catName.includes("trekking") || catName.includes("escursion");
            }).length;

            if (trekkingCount < minCount) {
              target.push({
                rule,
                reason: rule.message || `Questo evento richiede almeno ${minCount} esperienze di trekking completate.`,
              });
            }
            break;
          }

          case "min_attended_events": {
            const minCount = Number(rule.value) || 1;
            const { count } = await supabase
              .from("event_registrations")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("checked_in", true)
              .in("status", ["registered", "paid"]);

            if ((count || 0) < minCount) {
              target.push({
                rule,
                reason: rule.message || `Questo evento richiede almeno ${minCount} presenze totali.`,
              });
            }
            break;
          }

          case "require_badge": {
            const badgeId = rule.badge_id || rule.value;
            if (badgeId) {
              const { data: userBadge } = await supabase
                .from("user_badges")
                .select("id")
                .eq("user_id", user.id)
                .eq("badge_id", badgeId as string)
                .maybeSingle();

              if (!userBadge) {
                target.push({
                  rule,
                  reason: rule.message || `Questo evento richiede il badge "${rule.badge_name || "richiesto"}".`,
                });
              }
            }
            break;
          }

          case "manual_approval": {
            requiresApproval = true;
            break;
          }

          case "min_activities": {
            const minCount = Number(rule.value) || 1;
            const { count } = await supabase
              .from("event_registrations")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("checked_in", true)
              .in("status", ["registered", "paid"]);

            if ((count || 0) < minCount) {
              target.push({
                rule,
                reason: rule.message || `Questo evento richiede almeno ${minCount} attività completate.`,
              });
            }
            break;
          }

          case "min_level": {
            const requiredLevel = Number(rule.value) || 1;
            const userLevel = LEVEL_MAP[profile.self_level || ""] || 0;
            if (userLevel < requiredLevel) {
              target.push({
                rule,
                reason: rule.message || `Questo evento richiede almeno un livello ${LEVEL_LABELS[String(requiredLevel)] || "richiesto"}.`,
              });
            }
            break;
          }

          case "min_experience": {
            const requiredExp = Number(rule.value) || 1;
            const userExp = EXPERIENCE_MAP[profile.trekking_experience || ""] || 0;
            if (userExp < requiredExp) {
              target.push({
                rule,
                reason: rule.message || `Questo evento richiede almeno ${EXPERIENCE_LABELS[String(requiredExp)] || "l'esperienza richiesta"}.`,
              });
            }
            break;
          }

          case "min_activity_frequency": {
            const requiredFreq = Number(rule.value) || 1;
            const userFreq = FREQUENCY_MAP[profile.activity_frequency || ""] || 0;
            if (userFreq < requiredFreq) {
              target.push({
                rule,
                reason: rule.message || `Questo evento richiede una frequenza di attività minima: ${FREQUENCY_LABELS[String(requiredFreq)] || "richiesta"}.`,
              });
            }
            break;
          }

          case "interests": {
            // Interests are always soft
            const eventInterests = rule.interests || [];
            const userInterests = (profile as any).interests || [];
            if (eventInterests.length > 0) {
              const intersection = eventInterests.filter((i: string) => userInterests.includes(i));
              if (intersection.length === 0) {
                softWarnings.push({
                  rule,
                  reason: rule.message || "Questo evento potrebbe non essere perfettamente in linea con i tuoi interessi.",
                });
              }
            }
            break;
          }
        }
      }

      const hasAccess = failedRules.length === 0;
      const restrictionMessage = hasAccess
        ? null
        : accessRules.restriction_message || failedRules[0]?.reason || "Non hai i requisiti per accedere a questo evento.";

      return { hasAccess, failedRules, softWarnings, requiresApproval, restrictionMessage };
    },
    enabled: !!(accessRules?.rules?.length || difficulty),
    staleTime: 60_000,
  });
};

function getEffectiveEnforcement(rule: AccessRule): "hard" | "soft" {
  // manual_approval is always its own category
  if (rule.type === "manual_approval") return "hard";
  // interests are always soft
  if (rule.type === "interests") return "soft";
  // If explicitly set, use it
  if (rule.enforcement) return rule.enforcement;
  // Default: hard for all rule types
  return "hard";
}

// Difficulty-based safety check using onboarding data
async function checkDifficultyAccess(
  difficulty: string,
  userId: string | null,
  profile: any
): Promise<AccessCheckResult> {
  const diffLevel = parseInt(difficulty);
  if (isNaN(diffLevel) || diffLevel < 3 || !userId || !profile) {
    return { hasAccess: true, failedRules: [], softWarnings: [], requiresApproval: false, restrictionMessage: null };
  }

  const selfLevel = profile.self_level;
  const trekkingExp = profile.trekking_experience;
  const activityFreq = profile.activity_frequency;
  const experienceGrade = profile.experience_grade || 0;

  const checkProfileSuitability = () => {
    if (diffLevel === 3) {
      const levelOk = selfLevel === "intermediate" || selfLevel === "advanced";
      const expOk = trekkingExp === "3_5" || trekkingExp === "5_plus" || trekkingExp === "5+";
      const fitnessOk = activityFreq === "medium" || activityFreq === "high" || activityFreq === "1-2/week" || activityFreq === ">2/week";
      return (levelOk || expOk) && fitnessOk;
    }
    if (diffLevel >= 4) {
      const levelOk = selfLevel === "advanced";
      const expOk = trekkingExp === "5_plus" || trekkingExp === "5+";
      const fitnessOk = activityFreq === "high" || activityFreq === ">2/week";
      return levelOk && expOk && fitnessOk;
    }
    return false;
  };

  if (experienceGrade >= diffLevel * 2 || checkProfileSuitability()) {
    return { hasAccess: true, failedRules: [], softWarnings: [], requiresApproval: false, restrictionMessage: null };
  }

  const { data: pastEvents } = await supabase
    .from("event_registrations")
    .select("*, events(difficulty)")
    .eq("user_id", userId)
    .eq("checked_in", true)
    .in("status", ["registered", "paid"]);

  const easyCount = (pastEvents || []).filter(r => {
    const d = parseInt((r.events as any)?.difficulty);
    return !isNaN(d) && d <= 2;
  }).length;

  const interCount = (pastEvents || []).filter(r => {
    const d = parseInt((r.events as any)?.difficulty);
    return !isNaN(d) && d >= 3;
  }).length;

  if (diffLevel === 3 && easyCount >= 3) return { hasAccess: true, failedRules: [], softWarnings: [], requiresApproval: false, restrictionMessage: null };
  if (diffLevel >= 4 && interCount >= 3) return { hasAccess: true, failedRules: [], softWarnings: [], requiresApproval: false, restrictionMessage: null };

  // Difficulty-based checks are soft warnings (advisory), not hard blocks
  return {
    hasAccess: true,
    failedRules: [],
    softWarnings: [{
      rule: { type: "min_trekking_events", value: 3, enforcement: "soft" },
      reason: diffLevel >= 4
        ? "Questo evento è riservato a escursionisti esperti con livello avanzato e buona preparazione fisica."
        : "Per questo evento è consigliata esperienza intermedia e attività fisica regolare."
    }],
    requiresApproval: false,
    restrictionMessage: null,
  };
}

export const getExclusivityIndicators = (accessRules: AccessRulesConfig | null | undefined) => {
  if (!accessRules || !accessRules.rules || accessRules.rules.length === 0) return [];

  const indicators: { label: string; variant: "members" | "exclusive" | "community" | "restricted" }[] = [];

  if (accessRules.exclusivity_label) {
    indicators.push({ label: accessRules.exclusivity_label, variant: "exclusive" });
    return indicators;
  }

  const ruleTypes = accessRules.rules.map(r => r.type);

  if (ruleTypes.includes("require_membership")) {
    indicators.push({ label: "Members Only", variant: "members" });
  }
  if (ruleTypes.includes("require_badge")) {
    indicators.push({ label: "Exclusive Event", variant: "exclusive" });
  }
  if (ruleTypes.includes("min_trekking_events") || ruleTypes.includes("min_attended_events") || ruleTypes.includes("min_activities")) {
    indicators.push({ label: "Experience Required", variant: "restricted" });
  }
  if (ruleTypes.includes("min_level") || ruleTypes.includes("min_experience") || ruleTypes.includes("min_activity_frequency")) {
    indicators.push({ label: "Experience Required", variant: "restricted" });
  }
  if (ruleTypes.includes("manual_approval")) {
    indicators.push({ label: "Approval Required", variant: "community" });
  }

  return indicators;
};
