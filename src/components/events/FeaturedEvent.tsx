import { memo } from "react";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { EventWithDetails } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";
import { useLanguage } from "@/contexts/LanguageContext";

const FeaturedEvent = memo(({ event }: { event: EventWithDetails }) => {
  const { t, language } = useLanguage();
  
  const getCountdown = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return t("today");
    if (days === 1) return t("tomorrow");
    if (days < 0) return t("past");
    return t("inDays", { days });
  };

  const countdown = getCountdown(event.date);
  const isUrgent = countdown === t("today") || countdown === t("tomorrow");

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className="relative mx-4 rounded-2xl overflow-hidden shadow-xl press-scale">
        <OptimizedImage
          src={event.image_url}
          alt={event.title}
          width={600}
          height={280}
          className="w-full h-72 object-cover bg-muted transition-transform duration-700 group-hover:scale-105"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/95 via-foreground/40 to-foreground/5" />
        <div className="absolute top-4 left-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-bold shadow-lg ${
            isUrgent
              ? "bg-accent text-accent-foreground animate-pulse"
              : "bg-accent text-accent-foreground"
          }`}>
            {countdown}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 pb-6">
          <span className="text-[10px] font-body font-semibold text-primary-foreground/60 uppercase tracking-widest">{t("featuredEvent")}</span>
          <h2 className="font-display text-2xl font-bold text-primary-foreground mt-1.5 leading-tight">{event.title}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-primary-foreground/80 text-xs sm:text-sm font-body">
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{new Date(event.date).toLocaleDateString(language === "it" ? "it-IT" : "en-US", { day: "numeric", month: "short" })}</span>
            <span className="flex items-center gap-1 min-w-0"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{event.location}</span></span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" />{event.spots_taken}/{event.spots_total}</span>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-primary-foreground font-display font-bold text-xl">
              {Number(event.price) === 0 ? t("free") : `€${event.price}`}
            </span>
            <span className="flex items-center gap-1.5 text-accent text-sm font-body font-bold group-hover:gap-2.5 transition-all duration-200">
              {t("discover")} <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});

FeaturedEvent.displayName = "FeaturedEvent";

export default FeaturedEvent;
