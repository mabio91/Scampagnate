import { motion } from "framer-motion";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import { useEventImage } from "@/hooks/useEventImage";

const statusConfig = {
  available: { label: "Available", className: "bg-success/10 text-success" },
  full: { label: "Full", className: "bg-warning/10 text-warning" },
  closed: { label: "Closed", className: "bg-destructive/10 text-destructive" },
};

const EventCard = ({ event, index }: { event: EventWithDetails; index: number }) => {
  const imageSrc = useEventImage(event.image_url || "trekking");
  const status = statusConfig[event.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
    >
      <Link to={`/event/${event.id}`} className="block">
        <div className="flex gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-colors">
          <div className="relative flex-shrink-0">
            <img src={imageSrc} alt={event.title} className="w-24 h-24 rounded-xl object-cover" />
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
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                <Users className="h-3 w-3" />
                {event.spots_taken}/{event.spots_total}
              </div>
              <span className="font-body font-bold text-sm text-foreground">
                {Number(event.price) === 0 ? "Gratis" : `€${event.price}`}
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
    </motion.div>
  );
};

export default EventCard;
