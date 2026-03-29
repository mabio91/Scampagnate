import { memo, useMemo } from "react";
import { CalendarDays, MapPin, Users, Ticket, Crown, Star, Lock, Hand } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import { getExclusivityIndicators, type AccessRulesConfig } from "@/hooks/useEventAccessRules";
import OptimizedImage from "@/components/OptimizedImage";
import { DifficultyBadge } from "./DifficultyBadge";
import { UI_LABELS } from "@/lib/labels";
import { useEventFitScore } from "@/hooks/useEventFitScore";
import { resolveEventBadges } from "@/lib/eventBadges";

const exclusivityIcons: Record<string, typeof Crown> = {
  members: Crown,
  exclusive: Star,
  restricted: Lock,
  community: Hand,
};

export interface EventDiscount {
  discount_type: string;
  discount_value: number;
  code: string;
}

const EventCard = memo(({ event, index, discount, showCompatibility }: { event: EventWithDetails; index: number; discount?: EventDiscount | null; showCompatibility?: boolean }) => {
  const fillPercent = Math.min(100, (event.spots_taken / event.spots_total) * 100);
  const indicators = getExclusivityIndicators(event.access_rules as AccessRulesConfig | null);
  const spotsLeft = event.spots_total - event.spots_taken;

  const eventBadges = useMemo(() => resolveEventBadges({
    price: Number(event.price),
    spots_taken: event.spots_taken,
    spots_total: event.spots_total,
    status: event.status,
    access_rules: event.access_rules,
    event_badges: (event as any).event_badges,
  }), [event.price, event.spots_taken, event.spots_total, event.status, event.access_rules, (event as any).event_badges]);

  const fitScore = useEventFitScore(
    showCompatibility ? event.access_rules : null,
    showCompatibility ? { difficulty: event.difficulty, category: event.category } : null,
  );

  // Status badge
  const statusLabel = useMemo(() => {
    if (fillPercent > 80 && event.status !== "full" && event.status !== "closed" && event.status !== "cancelled" && event.status !== "past") {
      return { label: UI_LABELS.almostFull, className: "bg-warning/10 text-warning" };
    }
    const map: Record<string, { label: string; className: string }> = {
      draft: { label: UI_LABELS.draft, className: "bg-muted text-muted-foreground" },
      published: { label: UI_LABELS.open, className: "bg-success/10 text-success" },
      full: { label: UI_LABELS.full, className: "bg-destructive/10 text-destructive" },
      closed: { label: UI_LABELS.closed, className: "bg-muted text-muted-foreground" },
      cancelled: { label: UI_LABELS.cancelled, className: "bg-destructive/10 text-destructive" },
      past: { label: UI_LABELS.past, className: "bg-muted text-muted-foreground" },
    };
    return map[event.status || "published"] || map.published;
  }, [event.status, fillPercent]);

  // Fill bar color
  const fillColor = fillPercent > 80 ? "bg-destructive" : fillPercent > 50 ? "bg-warning" : "bg-success";

  // Price display
  const priceDisplay = useMemo(() => {
    if (Number(event.price) === 0) return UI_LABELS.free;
    const prices = event.price_options;
    if (prices && prices.length > 1) {
      const min = Math.min(...prices.map(p => p.price));
      return UI_LABELS.priceFrom(min);
    }
    return `€${event.price}`;
  }, [event.price, event.price_options]);

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="flex gap-3 p-3 rounded-2xl bg-card border border-transparent hover:border-border/50 hover:shadow-md active:scale-[0.98] transition-all duration-200">
        <div className="relative flex-shrink-0">
          <OptimizedImage
            src={event.image_url}
            alt={event.title}
            width={96}
            height={96}
            className="w-24 h-24 rounded-xl object-cover bg-muted transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {event.difficulty && (
            <div className="absolute top-1 left-1">
              <DifficultyBadge difficulty={event.difficulty} className="bg-background/80 backdrop-blur-md text-foreground shadow-sm px-1.5 py-0.5 text-[10px]" showLabel={false} />
            </div>
          )}
          {discount && (
            <div className="absolute bottom-1 left-1 right-1">
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent/90 backdrop-blur-md text-accent-foreground text-[9px] font-body font-bold shadow-sm">
                <Ticket className="h-2.5 w-2.5" />
                {discount.discount_type === "percentage" ? `-${discount.discount_value}%` : `-€${discount.discount_value}`}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-base font-bold text-foreground truncate">{event.title}</h3>
            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold ${statusLabel.className}`}>
              {statusLabel.label}
            </span>
          </div>

          {(indicators.length > 0 || (spotsLeft > 0 && spotsLeft <= 5 && event.status !== "full")) && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {indicators.map((ind, idx) => {
                const Icon = exclusivityIcons[ind.variant] || Star;
                return (
                  <span key={idx} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-body font-bold ${
                    ind.variant === "members" ? "bg-primary/10 text-primary" :
                    ind.variant === "exclusive" ? "bg-gold/10 text-gold" :
                    ind.variant === "restricted" ? "bg-warning/10 text-warning" :
                    "bg-secondary/10 text-secondary"
                  }`}>
                    <Icon className="h-2.5 w-2.5" />
                    {ind.label}
                  </span>
                );
              })}
              {spotsLeft > 0 && spotsLeft <= 5 && event.status !== "full" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive text-[9px] font-body font-bold">
                  🔥 {spotsLeft} posti rimasti
                </span>
              )}
            </div>
          )}

          {/* Compatibility badge */}
          {showCompatibility && !fitScore.hidden && !fitScore.profileIncomplete && (
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-body font-bold ${
                fitScore.color === "green" ? "bg-success/10 text-success" :
                fitScore.color === "amber" ? "bg-warning/10 text-warning" :
                "bg-destructive/10 text-destructive"
              }`}>
                {fitScore.labelDisplay}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 mt-1.5 text-muted-foreground text-xs font-body">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
            </span>
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
              <Users className="h-3 w-3" />
              <span>{event.spots_taken}/{event.spots_total}</span>
              <div className="w-12 h-1.5 rounded-full bg-muted ml-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${fillColor} transition-all duration-500 ease-out`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
            <span className="font-body font-bold text-sm text-foreground">
              {priceDisplay}
            </span>
          </div>
          {/* Stats line for outdoor events */}
          {event.distance && (
            <div className="mt-1.5 text-[11px] text-muted-foreground/70 font-body">
              {[event.distance, event.elevation, event.duration].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

EventCard.displayName = "EventCard";
export default EventCard;
