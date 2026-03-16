import { memo } from "react";
import { CalendarDays, MapPin, Users, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";
import { DifficultyBadge } from "./DifficultyBadge";
import { CapacityWarning } from "./CapacityWarning";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  published: { label: "Open", className: "bg-success/10 text-success" },
  full: { label: "Full", className: "bg-warning/10 text-warning" },
  closed: { label: "Closed", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  past: { label: "Past", className: "bg-muted text-muted-foreground" },
};

const fallbackStatus = statusConfig.published;

const getEventStatusDisplay = (status: string | null | undefined) => {
  if (!status || !Object.prototype.hasOwnProperty.call(statusConfig, status)) {
    return fallbackStatus;
  }

  return statusConfig[status];
};

export interface EventDiscount {
  discount_type: string;
  discount_value: number;
  code: string;
}

const EventCard = memo(({ event, index, discount }: { event: EventWithDetails; index: number; discount?: EventDiscount | null }) => {
  const status = getEventStatusDisplay(event.status);
  const fillPercent = Math.min(100, (event.spots_taken / event.spots_total) * 100);

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="flex gap-3 p-3 rounded-2xl bg-card card-hover press-scale border border-transparent hover:border-border/50">
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
            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>
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
              <span>{event.spots_taken} / {event.spots_total}</span>
              <div className="w-12 h-1.5 rounded-full bg-muted ml-1 overflow-hidden">
                <div
                  className="h-full rounded-full bg-secondary transition-all duration-500 ease-out"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
            <span className="font-body font-bold text-sm text-foreground">
              {Number(event.price) === 0 ? "Free" : `€${event.price}`}
            </span>
          </div>
          <CapacityWarning spotsTaken={event.spots_taken} spotsTotal={event.spots_total} className="mt-1.5" />
          {event.distance && (
            <div className="mt-1.5 text-[11px] text-muted-foreground/70 font-body">
              {event.distance} · {event.elevation} · {event.duration}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

EventCard.displayName = "EventCard";

export default EventCard;
