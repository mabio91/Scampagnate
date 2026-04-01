import { memo, useMemo } from "react";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";
import { UI_LABELS } from "@/lib/labels";

type HeroBadge = "sold_out" | "promo" | "top" | null;

function resolveHeroBadge(event: EventWithDetails): HeroBadge {
  if (event.spots_taken >= event.spots_total) return "sold_out";

  const badges = (event as any).event_badges;
  if (Array.isArray(badges)) {
    const hasPromo = badges.some((b: any) =>
      typeof b === "string"
        ? b.toLowerCase().includes("promo")
        : b?.label?.toLowerCase()?.includes("promo")
    );
    if (hasPromo) return "promo";
  }

  if (event.featured) return "top";
  return null;
}

const HERO_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  sold_out: {
    label: "SOLD OUT",
    className: "bg-destructive text-destructive-foreground",
  },
  promo: {
    label: "Promo",
    className: "bg-amber-500 text-white",
  },
  top: {
    label: "Evento top",
    className: "bg-primary text-primary-foreground",
  },
};

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
  const heroBadge = useMemo(() => resolveHeroBadge(event), [event]);
  const isSoldOut = event.spots_taken >= event.spots_total;

  const dateStr = new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const locationLabel = (event as any).location_label || event.location;

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="relative mx-3 sm:mx-4 rounded-2xl overflow-hidden shadow-xl active:scale-[0.98] transition-transform duration-200">
        {/* Background image */}
        <OptimizedImage
          src={event.image_url}
          alt={event.title}
          width={600}
          height={320}
          eager
          className="w-full h-60 sm:h-72 object-cover bg-muted transition-transform duration-700 group-hover:scale-105"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5" />

        {/* Diagonal SOLD OUT ribbon */}
        {isSoldOut && (
          <div className="absolute top-0 right-0 overflow-hidden w-28 h-28 pointer-events-none z-10">
            <div className="absolute top-[18px] right-[-34px] w-[170px] text-center rotate-45 bg-destructive/90 text-destructive-foreground text-[11px] font-bold font-body uppercase tracking-wider py-1.5 shadow-lg">
              SOLD OUT
            </div>
          </div>
        )}

        {/* Top row: countdown left, badge right */}
        <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 flex items-start justify-between">
          {/* Countdown pill */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-body font-bold shadow-lg ${
            isUrgent
              ? "bg-accent text-accent-foreground animate-pulse"
              : "bg-accent text-accent-foreground"
          }`}>
            {countdown}
          </span>

          {/* Top-right badge — premium rectangular with selective rounded corners */}
          {heroBadge && !isSoldOut && (
            <span className={`inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-bl-xl rounded-tr-xl text-[10px] sm:text-[11px] font-body font-bold shadow-lg ${HERO_BADGE_CONFIG[heroBadge].className}`}>
              {HERO_BADGE_CONFIG[heroBadge].label}
            </span>
          )}
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-5 sm:p-5 sm:pb-6">
          {/* Title — max 3 lines, dominant */}
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-1 leading-tight line-clamp-3 drop-shadow-md">
            {event.title}
          </h2>

          {/* Date + Location row */}
          <div className="flex items-center gap-3 mt-2.5 sm:mt-3 text-white/80 text-[12px] sm:text-sm font-body">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              {dateStr}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{locationLabel}</span>
            </span>
          </div>

          {/* CTA */}
          {!isSoldOut && (
            <div className="mt-3 sm:mt-4">
              <span className="inline-flex items-center gap-1.5 text-accent text-sm font-body font-bold group-hover:gap-2.5 transition-all duration-200">
                Scopri evento <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

FeaturedEvent.displayName = "FeaturedEvent";
export default FeaturedEvent;
