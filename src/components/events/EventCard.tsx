import { memo, useMemo } from "react";
import { CalendarDays, Clock, MapPin, Footprints, Mountain, Timer, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";
import { DifficultyBadge } from "./DifficultyBadge";
import { EventBadgePill } from "./EventBadgePill";
import DynamicIcon from "@/components/DynamicIcon";
import { UI_LABELS } from "@/lib/labels";
import SoldOutOverlay from "./SoldOutOverlay";
import {
  canOptionJoinWaitlist,
  isEventSoldOut,
  isOptionBookable,
  shouldShowPublicCapacity,
  type PriceOptionLike,
} from "@/lib/priceOptions";
import { isEventPastByDate } from "@/lib/eventDates";

export interface EventDiscount {
  discount_type: string;
  discount_value: number;
  code: string;
}

type CardStatus = "attended" | "joined" | "spot_available" | "coming_soon" | "waitlist" | "open" | "closed";

const STATUS_CONFIG: Record<CardStatus, { label: string; className: string }> = {
  attended: {
    label: UI_LABELS.statusAttended,
    className: "bg-primary/15 text-primary border-primary/30",
  },
  joined: {
    label: UI_LABELS.statusJoined,
    className: "bg-success/20 text-success border-success/30",
  },
  spot_available: {
    label: UI_LABELS.statusSpotAvailable,
    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  },
  coming_soon: {
    label: UI_LABELS.statusComingSoon,
    className: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  waitlist: {
    label: "Lista d'attesa",
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

export type UserRegistrationInfo = {
  status: string;
  checked_in?: boolean;
  payment_status?: string | null;
} | null;

type EventCardDetails = EventWithDetails & {
  event_price_options?: PriceOptionLike[];
  location_label?: string | null;
};

function resolveCardStatus(event: EventWithDetails, userReg: UserRegistrationInfo): CardStatus {
  const status = String(event.status || "");
  const isEventPast = ["past", "completed", "cancelled"].includes(status);
  const isPastDate = isEventPastByDate(event.date);
  const eventDetails = event as EventCardDetails;
  const priceOptions = eventDetails.price_options || eventDetails.event_price_options || [];
  const hasPriceOptions = priceOptions.length > 0;
  const hasBookableOption = hasPriceOptions
    ? priceOptions.some((option) => isOptionBookable(option, event))
    : isOptionBookable(null, event);
  const hasWaitlistOption = hasPriceOptions
    ? priceOptions.some((option) => canOptionJoinWaitlist(option, event))
    : canOptionJoinWaitlist(null, event);

  if ((isEventPast || isPastDate) && userReg?.checked_in) return "attended";
  if (userReg && (userReg.status === "registered" || userReg.status === "paid" || userReg.status === "attended")) return "joined";
  if (userReg?.status === "waitlist" && hasBookableOption) return "spot_available";
  if (["draft", "unpublished", "upcoming"].includes(status)) return "coming_soon";
  if (userReg?.status === "waitlist") return "waitlist";
  if (isEventPast || isPastDate) return "closed";
  if (["closed", "rescheduled"].includes(status)) return "closed";
  if (!hasBookableOption) return hasWaitlistOption ? "waitlist" : "closed";
  return "open";
}

const EventCard = memo(({
  event,
  index,
  discount,
  showCompatibility,
  isUserRegistered = false,
  userRegistration = null,
}: {
  event: EventWithDetails;
  index: number;
  discount?: EventDiscount | null;
  showCompatibility?: boolean;
  isUserRegistered?: boolean;
  userRegistration?: UserRegistrationInfo;
}) => {
  const isAboveFold = index < 4;
  const isSoldOut = isEventSoldOut(event);
  const showPublicCapacity = shouldShowPublicCapacity(event);
  const fillPercent = event.spots_total > 0
    ? Math.min(100, (event.spots_taken / event.spots_total) * 100)
    : 0;

  // Fill bar color: 0-49% green, 50-69% amber, 70%+ red
  const fillColor = fillPercent >= 70 ? "bg-destructive" : fillPercent >= 50 ? "bg-warning" : "bg-success";

  const cardStatus = useMemo(
    () => resolveCardStatus(event, userRegistration || (isUserRegistered ? { status: "registered" } : null)),
    [event, isUserRegistered, userRegistration],
  );
  const statusConfig = STATUS_CONFIG[cardStatus];

  const hasPromo = !!discount;

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

  const formattedTime = event.time?.slice(0, 5) || "";
  const locationLabel = (event as EventCardDetails).location_label || event.location;
  const hasDifficulty = Boolean(event.difficulty);
  const hasMetrics = Boolean(event.distance || event.elevation || event.duration);
  const useCompactCardLayout = !hasDifficulty && !hasMetrics;

  const showUrgency = fillPercent >= 70 && !isSoldOut;

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="bg-card rounded-2xl border border-border/40 hover:border-border/60 hover:shadow-md active:scale-[0.98] transition-all duration-200 overflow-hidden">
        <div className="flex gap-3 p-3 sm:p-4">
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
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
              <EventBadgePill className={`shrink-0 border ${statusConfig.className}`}>
                {statusConfig.label}
              </EventBadgePill>
            </div>

            <h3 className="font-display text-[15px] sm:text-base font-bold text-foreground line-clamp-3 leading-snug">
              {event.title}
            </h3>

            <div className="flex items-center gap-1 text-muted-foreground text-[11px] sm:text-xs font-body min-w-0">
              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </div>

            <div className={`mt-0.5 flex min-w-0 ${useCompactCardLayout ? "items-end justify-between gap-2" : "items-center gap-1.5"}`}>
              <div className="flex min-w-0 items-center gap-1.5">
                {event.category && (
                  <EventBadgePill className="min-w-0 max-w-full border border-border/60 bg-muted/30 text-foreground">
                    {event.category.icon && (
                      <span className="flex items-center justify-center shrink-0">
                        <DynamicIcon value={event.category.icon} size={12} />
                      </span>
                    )}
                    <span className="truncate">{event.category.name}</span>
                  </EventBadgePill>
                )}
                {!useCompactCardLayout && hasPromo && (
                  <EventBadgePill className="border border-amber-500/30 bg-amber-500/15 text-amber-600">
                    Promo
                  </EventBadgePill>
                )}
                {hasDifficulty && (
                  <DifficultyBadge difficulty={event.difficulty} className="shrink-0" showLabel={true} />
                )}
              </div>

              {useCompactCardLayout && showPublicCapacity && (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground font-body">
                    <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span>{event.spots_taken}/{event.spots_total} posti</span>
                  </div>
                  <div className="w-16 sm:w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isSoldOut ? "bg-destructive" : fillColor} transition-all duration-500 ease-out`}
                      style={{ width: `${isSoldOut ? 100 : fillPercent}%` }}
                    />
                  </div>
                  {showUrgency && (
                    <span className="text-[10px] font-body font-semibold text-destructive">
                      Ultimi posti!
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative h-20 w-20 flex-shrink-0 self-start overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28">
            <OptimizedImage
              src={event.image_url}
              alt={event.title}
              width={112}
              height={112}
              eager={isAboveFold}
              className={`h-full w-full object-cover transition-all duration-300 ${
                isSoldOut ? "grayscale" : ""
              }`}
            />
            {isSoldOut && (
              <SoldOutOverlay size="card" />
            )}
          </div>
        </div>

        {!useCompactCardLayout && (
          <div className="px-3 sm:px-4 pb-2.5 sm:pb-3 flex items-end justify-between gap-2">
            <div className="flex items-center gap-3 text-[11px] sm:text-xs text-muted-foreground font-body">
              {event.distance && (
                <span className="flex items-center gap-1">
                  <Footprints className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {event.distance}
                </span>
              )}
              {event.elevation && (
                <span className="flex items-center gap-1">
                  <Mountain className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {event.elevation}
                </span>
              )}
              {event.duration && (
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {event.duration}
                </span>
              )}
            </div>

            {showPublicCapacity && (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground font-body">
                  <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>{event.spots_taken}/{event.spots_total} posti</span>
                </div>
                <div className="w-16 sm:w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isSoldOut ? "bg-destructive" : fillColor} transition-all duration-500 ease-out`}
                    style={{ width: `${isSoldOut ? 100 : fillPercent}%` }}
                  />
                </div>
                {showUrgency && (
                  <span className="text-[10px] font-body font-semibold text-destructive">
                    Ultimi posti!
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
});

EventCard.displayName = "EventCard";
export default EventCard;
