import { memo, useMemo } from "react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";
import { DifficultyBadge } from "./DifficultyBadge";
import { UI_LABELS } from "@/lib/labels";

export interface EventDiscount {
  discount_type: string;
  discount_value: number;
  code: string;
}

type CardStatus = "joined" | "coming_soon" | "waitlist" | "open" | "closed";

const STATUS_CONFIG: Record<CardStatus, { label: string; className: string }> = {
  joined: {
    label: UI_LABELS.statusJoined,
    className: "bg-primary/15 text-primary border-primary/30",
  },
  coming_soon: {
    label: UI_LABELS.statusComingSoon,
    className: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  waitlist: {
    label: UI_LABELS.statusWaitlist,
    className: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  },
  open: {
    label: UI_LABELS.statusOpen,
    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  },
  closed: {
    label: UI_LABELS.statusClosed,
    className: "bg-muted text-muted-foreground border-border/50",
  },
};

function resolveCardStatus(event: EventWithDetails, isUserRegistered: boolean): CardStatus {
  // Priority 1: Joined
  if (isUserRegistered) return "joined";

  // Priority 2: Coming soon (draft = not yet open for registration)
  if (event.status === "draft") return "coming_soon";

  // Priority 3: Closed (past, cancelled, closed)
  if (event.status === "past" || event.status === "cancelled" || event.status === "closed") return "closed";

  // Priority 4: Waitlist (full but still accepting waitlist)
  if (event.status === "full") return "waitlist";

  // Priority 5: Open
  return "open";
}

type ImageBadge = "sold_out" | "promo" | null;

function resolveImageBadge(event: EventWithDetails): ImageBadge {
  // Priority 1: Sold Out (spots_taken >= spots_total)
  if (event.spots_taken >= event.spots_total) return "sold_out";

  // Priority 2: Promo (check event_badges or payment_type free as promo indicator)
  // We check additional_fields or event for a promo flag
  const badges = (event as any).event_badges;
  if (Array.isArray(badges)) {
    const hasPromo = badges.some((b: any) =>
      typeof b === "string"
        ? b.toLowerCase().includes("promo")
        : b?.label?.toLowerCase()?.includes("promo")
    );
    if (hasPromo) return "promo";
  }

  return null;
}

const IMAGE_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  sold_out: {
    label: UI_LABELS.badgeSoldOut,
    className: "bg-destructive text-destructive-foreground",
  },
  promo: {
    label: UI_LABELS.badgePromo,
    className: "bg-amber-500 text-white",
  },
};

const EventCard = memo(({
  event,
  index,
  discount,
  showCompatibility,
  isUserRegistered = false,
}: {
  event: EventWithDetails;
  index: number;
  discount?: EventDiscount | null;
  showCompatibility?: boolean;
  isUserRegistered?: boolean;
}) => {
  const isAboveFold = index < 4;
  const fillPercent = Math.min(100, (event.spots_taken / event.spots_total) * 100);

  // Fill bar color
  const fillColor = fillPercent > 80 ? "bg-destructive" : fillPercent > 50 ? "bg-warning" : "bg-success";

  // Status & badge resolution
  const cardStatus = useMemo(() => resolveCardStatus(event, isUserRegistered), [event, isUserRegistered]);
  const imageBadge = useMemo(() => resolveImageBadge(event), [event]);
  const statusConfig = STATUS_CONFIG[cardStatus];
  const badgeConfig = imageBadge ? IMAGE_BADGE_CONFIG[imageBadge] : null;

  // Format date like "Sab, 28 Mar"
  const formattedDate = useMemo(() => {
    const d = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(d);
    eventDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return UI_LABELS.today;
    if (diffDays === 1) return UI_LABELS.tomorrow;

    return d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })
      .replace(/^\w/, c => c.toUpperCase());
  }, [event.date]);

  // Format time like "08:30"
  const formattedTime = event.time?.slice(0, 5) || "";

  // Stats line: distance, duration
  const statsItems = useMemo(() => {
    const items: string[] = [];
    if (event.distance) items.push(event.distance);
    if (event.duration) items.push(event.duration);
    return items;
  }, [event.distance, event.duration]);

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="bg-card rounded-2xl border border-border/40 hover:border-border/60 hover:shadow-md active:scale-[0.98] transition-all duration-200 overflow-hidden">
        <div className="flex gap-3 p-3 sm:p-4">
          {/* Left content */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {/* Date & time row + status */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground text-[11px] sm:text-xs font-body min-w-0">
                <span className="flex items-center gap-1 shrink-0">
                  <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {formattedDate}
                </span>
                {formattedTime && (
                  <>
                    <span className="text-muted-foreground/50">|</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {formattedTime}
                    </span>
                  </>
                )}
              </div>
              {/* Status label */}
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold border ${statusConfig.className}`}>
                {statusConfig.label}
              </span>
            </div>

            {/* Title — up to 3 lines */}
            <h3 className="font-display text-[15px] sm:text-base font-bold text-foreground line-clamp-3 leading-snug">
              {event.title}
            </h3>

            {/* Location */}
            <div className="flex items-center gap-1 text-muted-foreground text-[11px] sm:text-xs font-body min-w-0">
              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="truncate">{(event as any).location_label || event.location}</span>
              {event.distance && (
                <>
                  <span className="text-muted-foreground/50 mx-0.5">|</span>
                  <span className="shrink-0">{event.distance}</span>
                </>
              )}
            </div>

            {/* Category badge */}
            {event.category && (
              <div className="mt-0.5">
                <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-border/60 bg-muted/30 text-[11px] sm:text-xs font-body font-medium text-foreground">
                  {event.category.icon && <span className="text-xs sm:text-sm">{event.category.icon}</span>}
                  {event.category.name}
                </span>
              </div>
            )}
          </div>

          {/* Right: thumbnail image with optional badge */}
          <div className="relative flex-shrink-0">
            <OptimizedImage
              src={event.image_url}
              alt={event.title}
              width={112}
              height={112}
              eager={isAboveFold}
              className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl object-cover bg-muted"
            />
            {/* Image badge (max 1) */}
            {badgeConfig && (
              <span className={`absolute top-1 left-1 sm:top-1.5 sm:left-1.5 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-body shadow-sm ${badgeConfig.className}`}>
                {badgeConfig.label}
              </span>
            )}
          </div>
        </div>

        {/* Bottom section: attributes + participants */}
        <div className="px-3 sm:px-4 pb-2.5 sm:pb-3 flex items-center justify-between gap-2">
          {/* Attributes: difficulty, duration */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {event.difficulty && (
              <DifficultyBadge difficulty={event.difficulty} className="bg-muted/50 text-foreground text-[10px] px-2 py-0.5" showLabel={false} />
            )}
            {statsItems.length > 0 && (
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-body">
                {statsItems.join(" · ")}
              </span>
            )}
          </div>

          {/* Participants bar */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-muted-foreground font-body shrink-0">
            <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>{event.spots_taken}/{event.spots_total}</span>
            <div className="w-8 sm:w-10 h-1.5 rounded-full bg-muted ml-0.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${fillColor} transition-all duration-500 ease-out`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});

EventCard.displayName = "EventCard";
export default EventCard;
