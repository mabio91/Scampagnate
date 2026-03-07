import { memo } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";

const statusConfig = {
  available: { label: "Available", className: "bg-success/10 text-success" },
  full: { label: "Full", className: "bg-warning/10 text-warning" },
  closed: { label: "Closed", className: "bg-destructive/10 text-destructive" },
};

const EventCard = memo(({ event, index }: { event: EventWithDetails; index: number }) => {
  const status = statusConfig[event.status];
  const fillPercent = Math.min(100, (event.spots_taken / event.spots_total) * 100);

  return (
    <Link to={`/event/${event.id}`} className="block">
      <div className="flex gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-colors">
        <div className="relative flex-shrink-0">
          <OptimizedImage
            src={event.image_url}
            alt={event.title}
            width={96}
            height={96}
            className="w-24 h-24 rounded-xl object-cover bg-muted"
          />
          {event.difficulty && (
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-body font-semibold bg-foreground/70 text-background">
              {event.difficulty}
            </span>
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
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{event.location}</span>
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
              <Users className="h-3 w-3" />
              <span>{event.spots_taken} / {event.spots_total}</span>
              <div className="w-12 h-1.5 rounded-full bg-muted ml-1">
                <div
                  className="h-full rounded-full bg-secondary transition-all"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
            <span className="font-body font-bold text-sm text-foreground">
              {Number(event.price) === 0 ? "Free" : `€${event.price}`}
            </span>
          </div>
          {event.distance && (
            <div className="mt-1 text-[11px] text-muted-foreground font-body">
              {event.difficulty} · {event.distance} · {event.elevation} · {event.duration}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

EventCard.displayName = "EventCard";

export default EventCard;
