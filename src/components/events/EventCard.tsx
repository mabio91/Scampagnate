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

const EventCard = memo(({ event, index, discount, showCompatibility }: { event: EventWithDetails; index: number; discount?: EventDiscount | null; showCompatibility?: boolean }) => {
  const fillPercent = Math.min(100, (event.spots_taken / event.spots_total) * 100);
  const spotsLeft = event.spots_total - event.spots_taken;

  // Fill bar color
  const fillColor = fillPercent > 80 ? "bg-destructive" : fillPercent > 50 ? "bg-warning" : "bg-success";

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

  // Stats line: distance, difficulty, duration
  const statsItems = useMemo(() => {
    const items: string[] = [];
    if (event.distance) items.push(event.distance);
    if (event.duration) items.push(event.duration);
    return items;
  }, [event.distance, event.duration]);

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="bg-card rounded-2xl border border-border/40 hover:border-border/60 hover:shadow-md active:scale-[0.98] transition-all duration-200 overflow-hidden">
        <div className="flex gap-3 p-4">
          {/* Left content */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {/* Date & time row */}
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-body">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
              {formattedTime && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formattedTime}
                  </span>
                </>
              )}
            </div>

            {/* Title — up to 3 lines */}
            <h3 className="font-display text-base font-bold text-foreground line-clamp-3 leading-snug">
              {event.title}
            </h3>

            {/* Location */}
            <div className="flex items-center gap-1 text-muted-foreground text-xs font-body min-w-0">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
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
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/60 bg-muted/30 text-xs font-body font-medium text-foreground">
                  {event.category.icon && <span className="text-sm">{event.category.icon}</span>}
                  {event.category.name}
                </span>
              </div>
            )}
          </div>

          {/* Right: thumbnail image */}
          <div className="relative flex-shrink-0">
            <OptimizedImage
              src={event.image_url}
              alt={event.title}
              width={112}
              height={112}
              className="w-28 h-28 rounded-xl object-cover bg-muted"
            />
          </div>
        </div>

        {/* Bottom section: attributes + participants */}
        <div className="px-4 pb-3 flex items-center justify-between gap-2">
          {/* Attributes: difficulty, duration */}
          <div className="flex items-center gap-2 flex-wrap">
            {event.difficulty && (
              <DifficultyBadge difficulty={event.difficulty} className="bg-muted/50 text-foreground text-[10px] px-2 py-0.5" showLabel={false} />
            )}
            {statsItems.length > 0 && (
              <span className="text-[11px] text-muted-foreground font-body">
                {statsItems.join(" · ")}
              </span>
            )}
          </div>

          {/* Participants bar */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body shrink-0">
            <Users className="h-3.5 w-3.5" />
            <span>{event.spots_taken}/{event.spots_total}</span>
            <div className="w-10 h-1.5 rounded-full bg-muted ml-0.5 overflow-hidden">
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
