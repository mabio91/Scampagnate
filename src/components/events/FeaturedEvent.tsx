import { memo, useMemo } from "react";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { EventWithDetails } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";
import { UI_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { eventBadgePillClassName } from "./EventBadgePill";
import SoldOutOverlay from "./SoldOutOverlay";
import { isEventSoldOut } from "@/lib/priceOptions";

type HeroBadge = "sold_out" | "promo" | "top" | null;

function resolveHeroBadge(event: EventWithDetails): HeroBadge {
  if (isEventSoldOut(event)) return "sold_out";

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

// exact same core style for badges: shape pill, padding 3 (12px) horizontal, 1.5 (6px) vertical, semi-transparent text white
const BADGE_CORE = `${eventBadgePillClassName} px-3 text-[11px] sm:text-xs text-white bg-black/50 backdrop-blur-sm z-20`;

const FeaturedEvent = memo(({ event }: { event: EventWithDetails }) => {
  const getCountdown = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Oggi";
    if (days === 1) return "Domani";
    return `Tra ${days} giorni`;
  };

  const countdown = getCountdown(event.date);
  const heroBadge = useMemo(() => resolveHeroBadge(event), [event]);
  const isSoldOut = isEventSoldOut(event);

  const dateStr = new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const locationLabel = (event as any).location_label || event.location;

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="relative mx-4 rounded-2xl overflow-hidden shadow-xl active:scale-[0.98] transition-transform duration-200">
        {/* Background image */}
        <OptimizedImage
          src={event.image_url}
          alt={event.title}
          width={600}
          height={320}
          eager
          className={cn(
            "w-full h-[260px] sm:h-[320px] object-cover bg-muted transition-transform duration-700 group-hover:scale-105",
            isSoldOut && "grayscale"
          )}
        />

        {/* Gradient overlay - strictly bottom to top for max readability, ~70% black to transparent */}
        <div className="absolute inset-x-0 bottom-0 top-1/4 bg-gradient-to-t from-black/75 to-transparent pointer-events-none z-10" />

        {isSoldOut && (
          <SoldOutOverlay size="hero" className="z-30" />
        )}

        {/* Top-left: Time badge - attached to corner, same pill style */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn("absolute top-0 left-0 rounded-tl-2xl rounded-br-[16px]", BADGE_CORE)}
        >
          {countdown}
        </motion.div>

        {/* Top-right: Event badge - attached to corner, same pill style. (Hide if sold out because of ribbon) */}
        {heroBadge && !isSoldOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn("absolute top-0 right-0 rounded-tr-2xl rounded-bl-[16px]", BADGE_CORE)}
          >
            {HERO_BADGE_LABEL[heroBadge]}
          </motion.div>
        )}

        {/* Bottom content: low as possible, inside overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end justify-between gap-3 z-20">
          <div className="flex-1 min-w-0 flex flex-col justify-end">
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              className="flex items-center gap-1.5 text-white/80 text-[11px] sm:text-xs font-body mb-1"
            >
              <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="truncate">
                {dateStr} · {locationLabel}
              </span>
            </motion.div>

            {/* Title: main visual focus, max 2 lines, tight line height */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
              className="font-display text-2xl sm:text-3xl font-bold text-white leading-[1.1] line-clamp-2 drop-shadow-lg"
            >
              {event.title}
            </motion.h2>
          </div>

          {/* New CTA Approach: subtle arrow inside card, tap entire card */}
          {!isSoldOut && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="shrink-0 mb-1"
            >
              <ArrowRight className="h-5 w-5 text-white/80 group-hover:translate-x-1 group-active:translate-x-2 transition-transform duration-300" />
            </motion.div>
          )}
        </div>
      </div>
    </Link>
  );
});

FeaturedEvent.displayName = "FeaturedEvent";
export default FeaturedEvent;
