import { memo, useMemo } from "react";
import { CalendarDays, Clock, MapPin, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import OptimizedImage from "@/components/OptimizedImage";
import DynamicIcon from "@/components/DynamicIcon";
import { DifficultyBadge } from "./DifficultyBadge";
import { UI_LABELS } from "@/lib/labels";
import { EventWithDetails } from "@/hooks/useEvents";

interface Props {
  events: EventWithDetails[];
}

const RecommendedCarouselCard = memo(({ event, index }: { event: EventWithDetails; index: number }) => {
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
  const locationLabel = (event as any).location_label || event.location;
  const statusLabel = event.status === "full"
    ? UI_LABELS.statusWaitlist
    : event.status === "closed" || event.status === "cancelled" || event.status === "past"
      ? UI_LABELS.statusClosed
      : UI_LABELS.statusOpen;
  const statusClassName = event.status === "full"
    ? "bg-orange-500/15 text-orange-600 border-orange-500/30"
    : event.status === "closed" || event.status === "cancelled" || event.status === "past"
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
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
            {event.featured ? (
              <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-foreground">
                Nuovo
              </span>
            ) : (
              <span />
            )}
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClassName}`}>
              {statusLabel}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-4 pt-10">
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
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] font-semibold text-foreground">
                {event.category.icon && (
                  <span className="flex shrink-0 items-center justify-center">
                    <DynamicIcon value={event.category.icon} size={12} />
                  </span>
                )}
                <span className="truncate">{event.category.name}</span>
              </span>
            )}
            {event.difficulty && <DifficultyBadge difficulty={event.difficulty} className="shrink-0" showLabel={true} />}
            </div>
          </div>

          <div />

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{event.spots_taken}/{event.spots_total} posti</span>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-foreground">
              {event.payment_type === "free" || Number(event.price) === 0 ? UI_LABELS.free : `EUR ${Number(event.price)}`}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
});

RecommendedCarouselCard.displayName = "RecommendedCarouselCard";

const RecommendedSection = memo(({ events }: Props) => {
  if (events.length === 0) return null;

  return (
    <section className="mb-6 px-4">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">
          {UI_LABELS.recommended}
        </h2>
      </div>
      <p className="mb-3 ml-7 text-xs font-body text-muted-foreground">
        {UI_LABELS.recommendedSubtitle}
      </p>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory [scroll-padding-inline:1rem]">
        <div className="flex items-stretch gap-4 pr-4">
          {events.slice(0, 3).map((event, i) => (
            <div
              key={event.id}
              className="h-[18.75rem] shrink-0 snap-center basis-[84%] sm:basis-[68%] lg:basis-[52%]"
            >
              <RecommendedCarouselCard event={event} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

RecommendedSection.displayName = "RecommendedSection";
export default RecommendedSection;
