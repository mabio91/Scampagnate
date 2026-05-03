import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive as isMembershipActiveFn } from "@/lib/membership";
import { ACTIVE_PARTICIPANT_STATUSES } from "@/lib/eventPayments";

export interface PriceOption {
  id: string;
  name: string;
  price: number;
  eligible_group: string;
  original_price: number | null;
  is_promotional: boolean;
  promo_start: string | null;
  promo_end: string | null;
  sort_order: number;
}

export interface ResolvedPriceOption extends PriceOption {
  isEligible: boolean;
  isPromoActive: boolean;
  eligibilityReason: string | null;
}

/**
 * Resolves which price options a user is eligible for based on their profile,
 * membership, badges, and event participation history.
 */
export const usePricingEligibility = (priceOptions: PriceOption[] | null | undefined) => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ["pricing-eligibility", priceOptions?.map(o => o.id), user?.id],
    queryFn: async (): Promise<ResolvedPriceOption[]> => {
      if (!priceOptions || priceOptions.length === 0) return [];

      const now = new Date();

      // Pre-fetch user data if logged in
      let attendedCount = 0;
      let userBadgeIds: string[] = [];
      let isMember = false;

      if (user && profile) {
        isMember = isMembershipActiveFn(profile);

        // Count attended events
        const { count } = await supabase
          .from("event_registrations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("checked_in", true)
          .in("status", [...ACTIVE_PARTICIPANT_STATUSES]);
        attendedCount = count || 0;

        // Get user badges
        const { data: badges } = await supabase
          .from("user_badges")
          .select("badge_id")
          .eq("user_id", user.id);
        userBadgeIds = (badges || []).map(b => b.badge_id);
      }

      return priceOptions.map((opt): ResolvedPriceOption => {
        // Check promo window
        const isPromoActive = opt.is_promotional
          ? isWithinPromoWindow(opt.promo_start, opt.promo_end, now)
          : true; // non-promo options are always "active"

        // If promo expired, not eligible
        if (opt.is_promotional && !isPromoActive) {
          return {
            ...opt,
            isEligible: false,
            isPromoActive: false,
            eligibilityReason: "Promozione scaduta",
          };
        }

        // Check group eligibility
        const { eligible, reason } = checkGroupEligibility(
          opt.eligible_group,
          { isLoggedIn: !!user, isMember, attendedCount, userBadgeIds }
        );

        return {
          ...opt,
          isEligible: eligible,
          isPromoActive,
          eligibilityReason: eligible ? null : reason,
        };
      });
    },
    enabled: !!(priceOptions && priceOptions.length > 0),
    staleTime: 60_000,
  });
};

function isWithinPromoWindow(
  start: string | null,
  end: string | null,
  now: Date
): boolean {
  if (start && new Date(start) > now) return false;
  if (end && new Date(end) < now) return false;
  return true;
}

interface UserContext {
  isLoggedIn: boolean;
  isMember: boolean;
  attendedCount: number;
  userBadgeIds: string[];
}

function checkGroupEligibility(
  group: string,
  ctx: UserContext
): { eligible: boolean; reason: string } {
  switch (group) {
    case "all":
      return { eligible: true, reason: "" };

    case "members":
      if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
      if (!ctx.isMember) return { eligible: false, reason: "Prezzo riservato ai membri attivi" };
      return { eligible: true, reason: "" };

    case "new_users":
      if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
      if (ctx.attendedCount > 0) return { eligible: false, reason: "Prezzo riservato ai nuovi utenti (0 eventi)" };
      return { eligible: true, reason: "" };

    case "experienced":
      if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
      if (ctx.attendedCount < 1) return { eligible: false, reason: "Prezzo riservato a chi ha già partecipato ad almeno 1 evento" };
      return { eligible: true, reason: "" };

    case "loyal":
      if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
      if (ctx.attendedCount < 5) return { eligible: false, reason: "Prezzo riservato ai partecipanti più attivi (5+ eventi)" };
      return { eligible: true, reason: "" };

    default:
      // badge:<id1>,<id2> pattern — user must have at least one
      if (group.startsWith("badge:")) {
        const badgeIds = group.replace("badge:", "").split(",").filter(Boolean);
        if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
        const hasAny = badgeIds.some(id => ctx.userBadgeIds.includes(id));
        if (!hasAny) return { eligible: false, reason: "Prezzo riservato a chi possiede un badge specifico" };
        return { eligible: true, reason: "" };
      }
      return { eligible: true, reason: "" };
  }
}

/**
 * Given resolved price options, return the best price the user can get
 */
export const getBestUserPrice = (
  resolvedOptions: ResolvedPriceOption[] | undefined,
  basePrice: number
): { price: number; label: string | null; originalPrice: number | null } => {
  if (!resolvedOptions || resolvedOptions.length === 0) {
    return { price: basePrice, label: null, originalPrice: null };
  }

  // First matching tier wins (evaluated in sort_order, top to bottom)
  const sorted = [...resolvedOptions].sort((a, b) => a.sort_order - b.sort_order);
  const firstMatch = sorted.find(o => o.isEligible && o.isPromoActive);

  if (firstMatch) {
    return { price: firstMatch.price, label: firstMatch.name, originalPrice: firstMatch.original_price };
  }

  // Fall back to "all" group options or base price
  const allGroup = resolvedOptions.filter(o => o.eligible_group === "all" && o.isPromoActive);
  if (allGroup.length > 0) {
    const first = allGroup.sort((a, b) => a.sort_order - b.sort_order)[0];
    return { price: first.price, label: first.name, originalPrice: first.original_price };
  }
  return { price: basePrice, label: null, originalPrice: null };
};
