import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive as isMembershipActiveFn } from "@/lib/membership";

export interface AccessRule {
  type: "min_trekking_events" | "min_activities" | "require_badge" | "require_membership" | "manual_approval" | "min_attended_events";
  value?: number | string;
  badge_id?: string;
  badge_name?: string;
  message?: string;
}

export interface AccessRulesConfig {
  rules: AccessRule[];
  restriction_message?: string;
  exclusivity_label?: string; // e.g. "Exclusive Event", "Members Only", "Community Priority"
}

export interface AccessCheckResult {
  hasAccess: boolean;
  failedRules: { rule: AccessRule; reason: string }[];
  requiresApproval: boolean;
  restrictionMessage: string | null;
}

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
        return { hasAccess: true, failedRules: [], requiresApproval: false, restrictionMessage: null };
      }

      if (!user || !profile) {
        return {
          hasAccess: false,
          failedRules: accessRules.rules.map(r => ({ rule: r, reason: "Devi effettuare il login" })),
          requiresApproval: false,
          restrictionMessage: accessRules.restriction_message || "Devi effettuare il login per verificare i requisiti di accesso.",
        };
      }

      const failedRules: { rule: AccessRule; reason: string }[] = [];
      let requiresApproval = false;

      for (const rule of accessRules.rules) {
        switch (rule.type) {
          case "require_membership": {
            if (!isMembershipActiveFn(profile)) {
              failedRules.push({
                rule,
                reason: rule.message || "Questa esperienza è riservata ai membri attivi della community.",
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
              failedRules.push({
                rule,
                reason: rule.message || `Questo evento è riservato a chi ha già partecipato ad almeno ${minCount} attività di trekking.`,
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
              failedRules.push({
                rule,
                reason: rule.message || `Questo evento è riservato a chi ha già partecipato ad almeno ${minCount} attività.`,
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
                failedRules.push({
                  rule,
                  reason: rule.message || `Per accedere a questo evento è necessario il badge "${rule.badge_name || "richiesto"}".`,
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
            // Alias for min_attended_events
            const minCount = Number(rule.value) || 1;
            const { count } = await supabase
              .from("event_registrations")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("checked_in", true)
              .in("status", ["registered", "paid"]);

            if ((count || 0) < minCount) {
              failedRules.push({
                rule,
                reason: rule.message || `L'accesso a questo evento è limitato ai partecipanti con esperienza precedente (minimo ${minCount} attività).`,
              });
            }
            break;
          }
        }
      }

      const hasAccess = failedRules.length === 0;
      const restrictionMessage = hasAccess
        ? null
        : accessRules.restriction_message || failedRules[0]?.reason || "Non hai i requisiti per accedere a questo evento.";

      return { hasAccess, failedRules, requiresApproval, restrictionMessage };
    },
    enabled: !!(accessRules?.rules?.length || difficulty),
    staleTime: 60_000,
  });
};

// Legacy difficulty-based check
async function checkDifficultyAccess(
  difficulty: string,
  userId: string | null,
  profile: any
): Promise<AccessCheckResult> {
  const diffLevel = parseInt(difficulty);
  if (isNaN(diffLevel) || diffLevel < 3 || !userId || !profile) {
    return { hasAccess: true, failedRules: [], requiresApproval: false, restrictionMessage: null };
  }

  const checkProfileCriteria = () => {
    const { trekking_experience, activity_frequency } = profile;
    if (diffLevel === 3) {
      const hasActivity = activity_frequency === "1-2/week" || activity_frequency === ">2/week";
      const hasTrekking = trekking_experience === "3-5" || trekking_experience === "5+";
      return hasActivity && hasTrekking;
    }
    if (diffLevel >= 4) {
      return activity_frequency === ">2/week" && trekking_experience === "5+";
    }
    return false;
  };

  if (checkProfileCriteria()) {
    return { hasAccess: true, failedRules: [], requiresApproval: false, restrictionMessage: null };
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

  if (diffLevel === 3 && easyCount >= 3) return { hasAccess: true, failedRules: [], requiresApproval: false, restrictionMessage: null };
  if (diffLevel >= 4 && interCount >= 3) return { hasAccess: true, failedRules: [], requiresApproval: false, restrictionMessage: null };

  return {
    hasAccess: false,
    failedRules: [{
      rule: { type: "min_trekking_events", value: 3 },
      reason: "Non hai i requisiti minimi di esperienza per questo evento."
    }],
    requiresApproval: false,
    restrictionMessage: "Non hai i requisiti minimi di esperienza per questo evento.",
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
  if (ruleTypes.includes("manual_approval")) {
    indicators.push({ label: "Approval Required", variant: "community" });
  }

  return indicators;
};
