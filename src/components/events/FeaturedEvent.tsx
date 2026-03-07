import { motion } from "framer-motion";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import { useEventImage } from "@/hooks/useEventImage";

const getCountdown = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today!";
  if (days === 1) return "Tomorrow";
  if (days < 0) return "Past";
  return `In ${days} days`;
};

const FeaturedEvent = ({ event }: { event: EventWithDetails }) => {
  const imageSrc = useEventImage(event.image_url || "trekking");

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Link to={`/event/${event.id}`} className="block">
        <div className="relative mx-4 rounded-2xl overflow-hidden shadow-lg">
          <img src={imageSrc} alt={event.title} className="w-full h-64 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/30 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-body font-semibold">
              {getCountdown(event.date)}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <span className="text-xs font-body font-medium text-primary-foreground/70 uppercase tracking-wider">Featured Event</span>
            <h2 className="font-display text-2xl font-bold text-primary-foreground mt-1">{event.title}</h2>
            <div className="flex items-center gap-4 mt-2 text-primary-foreground/80 text-sm font-body">
              <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{event.spots_taken}/{event.spots_total}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-primary-foreground font-body font-bold text-lg">
                {Number(event.price) === 0 ? "Gratis" : `€${event.price}`}
              </span>
              <span className="flex items-center gap-1 text-accent text-sm font-body font-semibold">Scopri <ArrowRight className="h-4 w-4" /></span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default FeaturedEvent;
