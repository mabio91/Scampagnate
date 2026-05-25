import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive as isMembershipActiveFn } from "@/lib/membership";
import { ACTIVE_PARTICIPANT_STATUSES } from "@/lib/eventPayments";
import { countUniqueAttendedEvents } from "@/lib/eventRegistrations";
import { getPromoWindowStatus } from "@/lib/promoPricing";

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
  payment_type?: "free" | "paid" | "deposit" | "location" | null;
  deposit_amount?: number | null;
  balance_amount?: number | null;
  balance_payment_mode?: "online" | "on_site" | null;
  has_dedicated_spots?: boolean | null;
  dedicated_spots?: number | null;
  spots_taken?: number | null;
  waitlist_enabled?: boolean | null;
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
    queryKey: [
      "pricing-eligibility",
      priceOptions?.map((o) => [o.id, o.is_promotional, o.promo_start, o.promo_end]),
      user?.id,
    ],
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
        const { data: attendedRows } = await supabase
          .from("event_registrations")
          .select("event_id, status, checked_in, created_at, sport_level")
          .eq("user_id", user.id)
          .or("status.eq.attended,checked_in.eq.true")
          .in("status", [...ACTIVE_PARTICIPANT_STATUSES]);
        attendedCount = countUniqueAttendedEvents((attendedRows || []).filter((r: any) => !r.sport_level?.startsWith("manual:")));

        // Get user badges
        const { data: badges } = await supabase
          .from("user_badges")
          .select("badge_id")
          .eq("user_id", user.id);
        userBadgeIds = (badges || []).map(b => b.badge_id);
      }

      return priceOptions.map((opt): ResolvedPriceOption => {
        const promoStatus = opt.is_promotional
          ? getPromoWindowStatus(opt.promo_start, opt.promo_end, now)
          : "active";
        const isPromoActive = promoStatus === "active";

        // If promo is outside its time window, it is not selectable.
        if (opt.is_promotional && !isPromoActive) {
          return {
            ...opt,
            isEligible: false,
            isPromoActive: false,
            eligibilityReason: promoStatus === "upcoming" ? "Promozione non ancora attiva" : "Promozione scaduta",
          };
        }

        // Check group eligibility
        const { eligible, reason } = checkGroupEligibility(
          opt.eligible_group,
          { isLoggedIn: !!user, userId: user?.id || null, profile, isMember, attendedCount, userBadgeIds }
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
    refetchInterval: priceOptions?.some((option) => option.is_promotional) ? 60_000 : false,
    staleTime: 60_000,
  });
};

interface UserContext {
  isLoggedIn: boolean;
  userId: string | null;
  profile: any;
  isMember: boolean;
  attendedCount: number;
  userBadgeIds: string[];
}

const thresholdFrom = (group: string, prefix: string) => {
  const raw = group.startsWith(`${prefix}:`) ? group.split(":")[1] : "";
  const parsed = Number.parseInt(raw || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
      if (
        ctx.profile?.self_level !== "advanced" &&
        Number(ctx.profile?.experience_grade || 0) < 3 &&
        ctx.profile?.trekking_experience !== "advanced"
      ) {
        return { eligible: false, reason: "Prezzo riservato agli utenti esperti" };
      }
      return { eligible: true, reason: "" };

    case "loyal":
      if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
      if (ctx.attendedCount < 3) return { eligible: false, reason: "Prezzo riservato ai partecipanti più attivi (3+ eventi)" };
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
      if (group.startsWith("trekking_gt:")) {
        if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
        const threshold = thresholdFrom(group, "trekking_gt");
        if (ctx.attendedCount <= threshold) return { eligible: false, reason: `Prezzo riservato a chi ha piu di ${threshold} trekking` };
        return { eligible: true, reason: "" };
      }
      if (group.startsWith("events_gt:")) {
        if (!ctx.isLoggedIn) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
        const threshold = thresholdFrom(group, "events_gt");
        if (ctx.attendedCount <= threshold) return { eligible: false, reason: `Prezzo riservato a chi ha piu di ${threshold} eventi` };
        return { eligible: true, reason: "" };
      }
      if (
        group.startsWith("user:") ||
        group.startsWith("user_id:") ||
        group.startsWith("profile:") ||
        group.startsWith("assigned_user:")
      ) {
        if (!ctx.isLoggedIn || !ctx.userId) return { eligible: false, reason: "Effettua il login per vedere questo prezzo" };
        const targetUserId = group.split(":").slice(1).join(":").trim().toLowerCase();
        if (targetUserId !== ctx.userId.toLowerCase()) return { eligible: false, reason: "Prezzo riservato a un utente specifico" };
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
