import { memo, useMemo } from "react";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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

const HERO_BADGE_LABEL: Record<string, string> = {
  sold_out: "SOLD OUT",
  promo: "Promo",
  top: "Evento top",
};

const BADGE_CLASS = "inline-flex items-center px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-body font-semibold text-white bg-black/50 backdrop-blur-sm shadow-lg";

const FeaturedEvent = memo(({ event }: { event: EventWithDetails }) => {
  const getCountdown = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return UI_LABELS.today;
    if (days === 1) return UI_LABELS.tomorrow;
    return UI_LABELS.inDays(days);
  };

  const countdown = getCountdown(event.date);
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

        {/* Gradient overlay — bottom to top */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

        {/* Diagonal SOLD OUT ribbon */}
        {isSoldOut && (
          <div className="absolute top-0 right-0 overflow-hidden w-28 h-28 pointer-events-none z-10">
            <div className="absolute top-[18px] right-[-34px] w-[170px] text-center rotate-45 bg-destructive/90 text-destructive-foreground text-[11px] font-bold font-body uppercase tracking-wider py-1.5 shadow-lg">
              SOLD OUT
            </div>
          </div>
        )}

        {/* Top badges — attached to corners */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3 sm:p-4">
          {/* Time badge — top-left */}
          <span className={BADGE_CLASS}>
            {countdown}
          </span>

          {/* Event badge — top-right */}
          {heroBadge && !isSoldOut && (
            <span className={BADGE_CLASS}>
              {HERO_BADGE_LABEL[heroBadge]}
            </span>
          )}
        </div>

        {/* Bottom content — as low as possible */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-4 sm:p-5 sm:pb-5 flex items-end justify-between gap-3">
          {/* Left: date + title */}
          <div className="flex-1 min-w-0">
            {/* Date & Location — single line */}
            <div className="flex items-center gap-1.5 text-white/80 text-[11px] sm:text-xs font-body mb-1.5">
              <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="truncate">
                {dateStr} · {locationLabel}
              </span>
            </div>

            {/* Title — max 2 lines, main focus */}
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
              className="font-display text-xl sm:text-2xl font-bold text-white leading-tight line-clamp-2 drop-shadow-md"
            >
              {event.title}
            </motion.h2>
          </div>

          {/* CTA arrow — bottom-right, visual hint only */}
          {!isSoldOut && (
            <div className="shrink-0 mb-0.5">
              <ArrowRight className="h-5 w-5 text-white/85 group-hover:translate-x-0.5 transition-transform duration-200" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

FeaturedEvent.displayName = "FeaturedEvent";
export default FeaturedEvent;
