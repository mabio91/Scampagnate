import { memo, useMemo } from "react";
import { CalendarDays, Clock, MapPin, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import OptimizedImage from "@/components/OptimizedImage";
import DynamicIcon from "@/components/DynamicIcon";
import { DifficultyBadge } from "./DifficultyBadge";
import { EventBadgePill } from "./EventBadgePill";
import { UI_LABELS } from "@/lib/labels";
import { EventWithDetails } from "@/hooks/useEvents";
import SoldOutOverlay from "./SoldOutOverlay";
import { isEventSoldOut, shouldShowPublicCapacity } from "@/lib/priceOptions";

interface Props {
  events: Array<{ event: EventWithDetails; whyText: string; score: number }>;
  registeredEventIds?: Set<string>;
}

type RecommendedEventDetails = EventWithDetails & {
  location_label?: string | null;
};

const RecommendedCarouselCard = memo(({ event, whyText, index, isUserRegistered = false }: { event: EventWithDetails; whyText: string; index: number; isUserRegistered?: boolean }) => {
  const isAboveFold = index < 2;
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
  const locationLabel = (event as RecommendedEventDetails).location_label || event.location;
  const isSoldOut = isEventSoldOut(event);
  const showPublicCapacity = shouldShowPublicCapacity(event);
  const eventStatus = String(event.status || "");
  const isClosedStatus = ["closed", "cancelled", "past", "completed", "rescheduled"].includes(eventStatus);
  const isUpcomingStatus = ["draft", "unpublished", "upcoming"].includes(eventStatus);
  const statusLabel = isUserRegistered
    ? UI_LABELS.statusJoined
    : isSoldOut
      ? "Sold out"
      : isUpcomingStatus
        ? UI_LABELS.statusComingSoon
      : isClosedStatus
        ? UI_LABELS.statusClosed
        : UI_LABELS.statusOpen;
  const statusClassName = isUserRegistered
    ? "bg-success/20 text-success border-success/30"
    : isSoldOut
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : isUpcomingStatus
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
      : isClosedStatus
        ? "bg-muted text-muted-foreground border-border/50"
        : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";

  return (
    <Link to={`/event/${event.id}`} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-border/40 bg-card shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="relative h-32 shrink-0 overflow-hidden bg-muted">
          <OptimizedImage
            src={event.image_url}
            alt={event.title}
            width={720}
            height={610}
            eager={isAboveFold}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${isSoldOut ? "grayscale" : ""}`}
          />
          <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3">
            {event.featured ? (
              <EventBadgePill className="bg-primary uppercase tracking-[0.08em] text-primary-foreground">
                Nuovo
              </EventBadgePill>
            ) : (
              <span />
            )}
            {!isSoldOut && (
              <EventBadgePill className={`border ${statusClassName}`}>
                {statusLabel}
              </EventBadgePill>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-4 pt-10">
            <div className="flex items-center gap-2 text-[11px] text-white/90">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
              {formattedTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formattedTime}
                </span>
              )}
            </div>
          </div>
          {isSoldOut && <SoldOutOverlay size="card" className="z-20" />}
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_auto_1fr_auto] px-4 pb-4 pt-3">
          <div className="min-h-[2.6rem]">
            <h3 className="line-clamp-2 font-display text-[1.05rem] leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[1.15rem]">
              {event.title}
            </h3>
          </div>

          <div className="mt-2 min-h-[2.4rem]">
            <div className="flex items-start gap-2 text-[13px] text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="line-clamp-2">{locationLabel}</span>
            </div>
          </div>

          <div className="mt-2 max-h-[2.4rem] min-h-[2.4rem] overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
            {event.category && (
              <EventBadgePill className="min-w-0 max-w-full border border-border/60 bg-muted/30 text-foreground">
                {event.category.icon && (
                  <span className="flex shrink-0 items-center justify-center">
                    <DynamicIcon value={event.category.icon} size={12} />
                  </span>
                )}
                <span className="truncate">{event.category.name}</span>
              </EventBadgePill>
            )}
            {event.difficulty && <DifficultyBadge difficulty={event.difficulty} className="shrink-0" showLabel={true} />}
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-muted/35 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {UI_LABELS.recommendedWhyTitle}
            </p>
            <p className="mt-1 text-xs leading-snug text-foreground/85">
              {whyText}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3 text-sm text-muted-foreground">
            {showPublicCapacity ? (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>{event.spots_taken}/{event.spots_total} posti</span>
              </div>
            ) : <span />}
              <EventBadgePill className="bg-muted text-foreground">
                {event.payment_type === "free" || Number(event.price) === 0 ? UI_LABELS.free : `EUR ${Number(event.price)}`}
              </EventBadgePill>
            </div>
        </div>
      </article>
    </Link>
  );
});

RecommendedCarouselCard.displayName = "RecommendedCarouselCard";

const RecommendedSection = memo(({ events, registeredEventIds }: Props) => {
  if (events.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-1 flex items-center gap-2 px-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">
          {UI_LABELS.recommended}
        </h2>
      </div>
      <p className="mb-3 px-4 pl-11 text-xs font-body text-muted-foreground">
        {UI_LABELS.recommendedSubtitle}
      </p>

      <div className="overflow-x-auto pb-2 no-scrollbar scroll-smooth snap-x snap-mandatory overscroll-x-contain">
        <div className="flex gap-3 px-4">
          {events.slice(0, 6).map((item, i) => (
            <div
              key={item.event.id}
              className="h-[22.5rem] w-[72%] shrink-0 snap-start sm:w-[58%] lg:w-[52%] xl:w-[24rem]"
            >
              <RecommendedCarouselCard
                event={item.event}
                whyText={item.whyText}
                index={i}
                isUserRegistered={!!registeredEventIds?.has(item.event.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

RecommendedSection.displayName = "RecommendedSection";
export default RecommendedSection;
