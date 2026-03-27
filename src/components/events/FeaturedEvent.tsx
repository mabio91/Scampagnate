import { memo } from "react";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";
import { UI_LABELS } from "@/lib/labels";

const FeaturedEvent = memo(({ event }: { event: EventWithDetails }) => {
  const getCountdown = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return UI_LABELS.today;
    if (days === 1) return UI_LABELS.tomorrow;
    return UI_LABELS.inDays(days);
  };

  const countdown = getCountdown(event.date);
  const isUrgent = countdown === UI_LABELS.today || countdown === UI_LABELS.tomorrow;

  // Urgency badge (only one, by priority)
  const fillPercent = (event.spots_taken / event.spots_total) * 100;
  const urgencyBadge = (() => {
    if (fillPercent > 85) return { label: UI_LABELS.urgencyLastSpots, className: "bg-destructive text-destructive-foreground" };
    if (fillPercent > 65) return { label: UI_LABELS.urgencyAlmostFull, className: "bg-warning text-warning-foreground" };
    if (event.featured) return { label: UI_LABELS.urgencyTopEvent, className: "bg-primary text-primary-foreground" };
    if (Number(event.price) === 0) return { label: UI_LABELS.urgencyFree, className: "bg-success text-success-foreground" };
    return null;
  })();

  // Metadata row
  const dateStr = new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const difficulty = event.difficulty ? `Livello ${event.difficulty}` : null;
  const metaParts = [dateStr, event.location, `${event.spots_taken}/${event.spots_total}`, difficulty].filter(Boolean);

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="relative mx-4 rounded-2xl overflow-hidden shadow-xl active:scale-[0.98] transition-transform duration-200">
        <OptimizedImage
          src={event.image_url}
          alt={event.title}
          width={600}
          height={280}
          className="w-full h-72 object-cover bg-muted transition-transform duration-700 group-hover:scale-105"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/95 via-foreground/40 to-foreground/5" />

        {/* Top badges row */}
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-bold shadow-lg ${
            isUrgent
              ? "bg-accent text-accent-foreground animate-pulse"
              : "bg-accent text-accent-foreground"
          }`}>
            {countdown}
          </span>
          {urgencyBadge && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-body font-bold shadow-lg ${urgencyBadge.className}`}>
              {urgencyBadge.label}
            </span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 pb-6">
          <span className="text-[10px] font-body font-semibold text-primary-foreground/60 uppercase tracking-widest">
            {UI_LABELS.featuredEvent}
          </span>
          <h2 className="font-display text-xl font-bold text-primary-foreground mt-1.5 leading-tight">{event.title}</h2>
          <div className="flex flex-wrap items-center gap-x-1 mt-2.5 text-primary-foreground/80 text-xs font-body">
            {metaParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i === 0 && <CalendarDays className="h-3.5 w-3.5 shrink-0" />}
                {i === 1 && <MapPin className="h-3.5 w-3.5 shrink-0" />}
                {i === 2 && <Users className="h-3.5 w-3.5 shrink-0" />}
                <span className={i === 1 ? "truncate max-w-[140px]" : ""}>{part}</span>
                {i < metaParts.length - 1 && <span className="mx-0.5">·</span>}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-primary-foreground font-display font-bold text-lg">
              {Number(event.price) === 0 ? UI_LABELS.free : `€${event.price}`}
            </span>
            <span className="flex items-center gap-1.5 text-accent text-sm font-body font-bold group-hover:gap-2.5 transition-all duration-200">
              {UI_LABELS.discover} <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});

FeaturedEvent.displayName = "FeaturedEvent";
export default FeaturedEvent;
