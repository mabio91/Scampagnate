/**
 * Event Badge System
 * 
 * Resolves up to 2 badges per event based on automatic rules + manual selection.
 * Priority (highest first): ULTIMI_POSTI > FOUNDING_EVENT > GRATUITO > manual badges
 */

export interface EventBadge {
  key: string;
  label: string;
  emoji: string;
  className: string; // tailwind classes for pill styling
}

const BADGE_CATALOG: Record<string, Omit<EventBadge, "key">> = {
  ultimi_posti: {
    label: "Ultimi posti",
    emoji: "🔥",
    className: "bg-destructive/90 text-destructive-foreground",
  },
  founding_event: {
    label: "Founding Event",
    emoji: "👑",
    className: "bg-primary/90 text-primary-foreground",
  },
  gratuito: {
    label: "Gratuito",
    emoji: "🎉",
    className: "bg-success/90 text-success-foreground",
  },
  evento_top: {
    label: "Evento Top",
    emoji: "⭐",
    className: "bg-gold/90 text-foreground",
  },
  best_seller: {
    label: "Best Seller",
    emoji: "🏆",
    className: "bg-amber-500/90 text-white",
  },
  consigliato: {
    label: "Consigliato",
    emoji: "👍",
    className: "bg-primary/80 text-primary-foreground",
  },
  prezzo_speciale: {
    label: "Prezzo Speciale",
    emoji: "💰",
    className: "bg-accent/90 text-accent-foreground",
  },
  early_bird: {
    label: "Early Bird",
    emoji: "🐦",
    className: "bg-sky-500/90 text-white",
  },
};

export const MANUAL_BADGE_OPTIONS = [
  { value: "evento_top", label: "⭐ Evento Top" },
  { value: "best_seller", label: "🏆 Best Seller" },
  { value: "consigliato", label: "👍 Consigliato" },
  { value: "prezzo_speciale", label: "💰 Prezzo Speciale" },
  { value: "early_bird", label: "🐦 Early Bird" },
] as const;

interface EventForBadges {
  price: number;
  payment_type?: string | null;
  spots_taken: number;
  spots_total: number;
  status?: string;
  access_rules?: any;
  event_badges?: string[] | null; // manual badges + custom
}

/**
 * Check if event is restricted to founding members only
 */
function isFoundingEvent(accessRules: any): boolean {
  if (!accessRules?.rules) return false;
  return accessRules.rules.some(
    (r: any) => r.type === "founding_member" || r.type === "is_founding_member"
  );
}

/**
 * Resolve up to 2 badges for display, applying priority order.
 */
export function resolveEventBadges(event: EventForBadges): EventBadge[] {
  const autoBadges: string[] = [];
  const fillPercent = event.spots_total > 0
    ? (event.spots_taken / event.spots_total) * 100
    : 0;

  // Auto: ULTIMI POSTI (fill ≥ 80%, not already full/closed/cancelled/past)
  if (
    fillPercent >= 80 &&
    event.status !== "full" &&
    event.status !== "closed" &&
    event.status !== "cancelled" &&
    event.status !== "past"
  ) {
    autoBadges.push("ultimi_posti");
  }

  // Auto: FOUNDING EVENT
  if (isFoundingEvent(event.access_rules)) {
    autoBadges.push("founding_event");
  }

  // Auto: GRATUITO
  if (event.payment_type === "free" && Number(event.price) === 0) {
    autoBadges.push("gratuito");
  }

  // Manual badges from event_badges field
  const manualBadges = (event.event_badges || []).filter(Boolean);

  // Merge in priority order, max 2
  const priorityOrder = [
    "ultimi_posti",
    "founding_event",
    "gratuito",
    ...manualBadges,
  ];

  // Deduplicate and keep order
  const seen = new Set<string>();
  const result: EventBadge[] = [];

  for (const key of priorityOrder) {
    if (seen.has(key)) continue;
    seen.add(key);

    // Check if it's an auto badge or manual badge
    if (!autoBadges.includes(key) && !manualBadges.includes(key)) continue;

    const catalog = BADGE_CATALOG[key];
    if (catalog) {
      result.push({ key, ...catalog });
    } else {
      // Custom badge (free text)
      result.push({
        key,
        label: key,
        emoji: "",
        className: "bg-muted/90 text-foreground",
      });
    }

    if (result.length >= 2) break;
  }

  return result;
}
