import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CalendarDays, MapPin, Users, Clock, Mountain,
  Route, Share2, Navigation, ChevronRight
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { mockEvents } from "@/data/mockEvents";
import { useEventImage } from "@/hooks/useEventImage";
import { Button } from "@/components/ui/button";

const ctaConfig = {
  available: { label: "Partecipa", className: "bg-primary text-primary-foreground hover:bg-primary/90" },
  full: { label: "Lista d'attesa", className: "bg-secondary text-secondary-foreground hover:bg-secondary/90" },
  closed: { label: "Evento Chiuso", className: "bg-muted text-muted-foreground cursor-not-allowed" },
};

const EventDetail = () => {
  const { id } = useParams();
  const event = mockEvents.find((e) => e.id === id);

  if (!event) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground font-body">Evento non trovato</p>
          <Link to="/" className="text-primary font-body mt-2">Torna alla Home</Link>
        </div>
      </AppLayout>
    );
  }

  const imageSrc = useEventImage(event.image);
  const cta = ctaConfig[event.status];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative">
        <img src={imageSrc} alt={event.title} className="w-full h-72 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
        <Link
          to="/"
          className="absolute top-4 left-4 p-2 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <button className="absolute top-4 right-4 p-2 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground">
          <Share2 className="h-5 w-5" />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          {event.difficulty && (
            <span className="inline-block px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-body font-semibold mb-2">
              {event.difficulty}
            </span>
          )}
          <h1 className="font-display text-3xl font-bold text-primary-foreground">{event.title}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {/* Quick Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-4 py-4 border-b border-border"
        >
          <div className="flex items-center gap-2 text-sm font-body text-foreground">
            <CalendarDays className="h-4 w-4 text-secondary" />
            {new Date(event.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            <span className="text-muted-foreground">· {event.time}</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-body text-foreground">
            <MapPin className="h-4 w-4 text-secondary" />
            {event.location}
          </div>
        </motion.div>

        {/* Stats */}
        {event.distance && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-4 gap-2 py-4 border-b border-border"
          >
            <div className="text-center">
              <Route className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.distance}</p>
              <p className="text-[10px] text-muted-foreground font-body">Distanza</p>
            </div>
            <div className="text-center">
              <Mountain className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.elevation}</p>
              <p className="text-[10px] text-muted-foreground font-body">Dislivello</p>
            </div>
            <div className="text-center">
              <Clock className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.duration}</p>
              <p className="text-[10px] text-muted-foreground font-body">Durata</p>
            </div>
            <div className="text-center">
              <Users className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.spotsTaken}/{event.spotsTotal}</p>
              <p className="text-[10px] text-muted-foreground font-body">Posti</p>
            </div>
          </motion.div>
        )}

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="py-4 border-b border-border"
        >
          <h3 className="font-display text-lg font-bold text-foreground mb-2">Descrizione</h3>
          <p className="text-sm font-body text-muted-foreground leading-relaxed">{event.description}</p>
        </motion.div>

        {/* Meeting Points */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="py-4 border-b border-border"
        >
          <h3 className="font-display text-lg font-bold text-foreground mb-3">Punti di Ritrovo</h3>
          <div className="space-y-3">
            {event.meetingPoints.map((mp, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground">{mp.name}</p>
                  <p className="text-xs font-body text-muted-foreground">{mp.location} · {mp.time}</p>
                </div>
                <Navigation className="h-4 w-4 text-secondary flex-shrink-0" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Participants */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="py-4 border-b border-border"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold text-foreground">Partecipanti</h3>
            <span className="text-sm font-body text-muted-foreground">
              {event.spotsTaken} / {event.spotsTotal}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-muted mb-3">
            <div
              className="h-full rounded-full bg-secondary transition-all"
              style={{ width: `${(event.spotsTaken / event.spotsTotal) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {event.participants.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-body">
                <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                  {p.name[0]}
                </span>
                <span className="text-foreground">{p.name}</span>
                {p.badge && <span>{p.badge}</span>}
              </div>
            ))}
            {event.spotsTaken > 5 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-sm font-body text-muted-foreground">
                +{event.spotsTaken - 5} altri
                <ChevronRight className="h-3 w-3" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Price Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="py-4"
        >
          {event.paymentType === "deposit" && event.deposit && (
            <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 mb-4">
              <p className="text-sm font-body font-semibold text-foreground">Pagamento con acconto</p>
              <p className="text-xs font-body text-muted-foreground mt-1">
                Acconto: €{event.deposit} · Saldo: €{event.price - event.deposit} da pagare in loco
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border p-4 pb-safe z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-body text-muted-foreground">Prezzo</p>
            <p className="text-xl font-display font-bold text-foreground">
              {event.price === 0 ? "Gratis" : `€${event.price}`}
            </p>
          </div>
          <Button
            className={`px-8 py-3 rounded-xl font-body font-semibold text-base ${cta.className}`}
            disabled={event.status === "closed"}
          >
            {cta.label}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventDetail;
