import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive as isMembershipActiveFn } from "@/lib/membership";

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
          .in("status", ["registered", "paid"]);
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

    case "experienced":
      if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
      if (ctx.attendedCount < 1) return { eligible: false, reason: "Prezzo riservato a chi ha già partecipato ad almeno 1 evento" };
      return { eligible: true, reason: "" };

    case "loyal":
      if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
      if (ctx.attendedCount < 5) return { eligible: false, reason: "Prezzo riservato ai partecipanti più attivi (5+ eventi)" };
      return { eligible: true, reason: "" };

    default:
      // badge:<id> pattern
      if (group.startsWith("badge:")) {
        const badgeId = group.replace("badge:", "");
        if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
        if (!ctx.userBadgeIds.includes(badgeId)) return { eligible: false, reason: "Prezzo riservato a chi possiede un badge specifico" };
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

  const eligible = resolvedOptions.filter(o => o.isEligible && o.isPromoActive);
  if (eligible.length === 0) {
    // Fall back to "all" group options or base price
    const allGroup = resolvedOptions.filter(o => o.eligible_group === "all" && o.isPromoActive);
    if (allGroup.length > 0) {
      const cheapest = allGroup.reduce((a, b) => a.price < b.price ? a : b);
      return { price: cheapest.price, label: cheapest.name, originalPrice: cheapest.original_price };
    }
    return { price: basePrice, label: null, originalPrice: null };
  }

  const cheapest = eligible.reduce((a, b) => a.price < b.price ? a : b);
  return { price: cheapest.price, label: cheapest.name, originalPrice: cheapest.original_price };
};
