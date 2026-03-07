import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CalendarDays, MapPin, Users, Clock, Mountain,
  Route, Share2, Navigation, ChevronRight, Heart, Bookmark
} from "lucide-react";
import { useEvent, useEventParticipants, useMyRegistration, useRegisterForEvent, useCancelRegistration } from "@/hooks/useEvents";
import { useEventImage } from "@/hooks/useEventImage";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: event, isLoading } = useEvent(id!);
  const { data: participants } = useEventParticipants(id!);
  const { data: myRegistration } = useMyRegistration(id!);
  const registerMutation = useRegisterForEvent();
  const cancelMutation = useCancelRegistration();

  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState("");
  const [sportLevel, setSportLevel] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full h-72" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground font-body">Evento non trovato</p>
        <Link to="/" className="text-primary font-body mt-2">Torna alla Home</Link>
      </div>
    );
  }

  const imageSrc = useEventImage(event.image_url || "trekking");
  const isRegistered = myRegistration && myRegistration.status !== "cancelled";
  const isSportCategory = event.category?.name === "Sport & Movimento";

  const handleCTA = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (isRegistered) return;
    if (event.status === "closed") return;

    if (event.status === "full") {
      setShowRegisterDialog(true);
      return;
    }

    setShowRegisterDialog(true);
  };

  const handleRegister = async () => {
    const isWaitlist = event.status === "full";
    try {
      await registerMutation.mutateAsync({
        eventId: event.id,
        meetingPointId: selectedMeetingPoint || undefined,
        sportLevel: sportLevel || undefined,
        asWaitlist: isWaitlist,
      });
      setShowRegisterDialog(false);
      if (isWaitlist) {
        toast({ title: "In lista d'attesa! ⏳", description: `Sarai notificato quando si libera un posto per ${event.title}` });
      } else {
        toast({ title: "Iscrizione confermata! ✅", description: `Ti sei iscritto a ${event.title}` });
      }
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(event.id);
      toast({ title: "Iscrizione annullata", description: "La tua iscrizione è stata cancellata." });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const getCTALabel = () => {
    if (isRegistered) return "Iscritto ✔";
    if (event.status === "full") return "Lista d'attesa";
    if (event.status === "closed") return "Evento Chiuso";
    return "Partecipa";
  };

  const getCTAClass = () => {
    if (isRegistered) return "bg-success text-success-foreground";
    if (event.status === "full") return "bg-secondary text-secondary-foreground hover:bg-secondary/90";
    if (event.status === "closed") return "bg-muted text-muted-foreground cursor-not-allowed";
    return "bg-primary text-primary-foreground hover:bg-primary/90";
  };

  const shareEvent = async () => {
    const url = window.location.href;
    const text = `${event.title} - ${new Date(event.date).toLocaleDateString("it-IT")}`;
    if (navigator.share) {
      await navigator.share({ title: event.title, text, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiato!" });
    }
  };

  const openDirections = (location: string) => {
    const encoded = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative">
        <img src={imageSrc} alt={event.title} className="w-full h-72 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
        <Link to="/" className="absolute top-4 left-4 p-2 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <button onClick={shareEvent} className="absolute top-4 right-4 p-2 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground">
          <Share2 className="h-5 w-5" />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 mb-2">
            {event.difficulty && (
              <span className="inline-block px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-body font-semibold">
                {event.difficulty}
              </span>
            )}
            {event.category && (
              <span className="inline-block px-2.5 py-1 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground text-xs font-body font-semibold">
                {event.category.icon} {event.category.name}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-bold text-primary-foreground">{event.title}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {/* Quick Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-4 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-body text-foreground">
            <CalendarDays className="h-4 w-4 text-secondary" />
            {new Date(event.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            <span className="text-muted-foreground">· {event.time?.slice(0, 5)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-body text-foreground">
            <MapPin className="h-4 w-4 text-secondary" />
            {event.location}
          </div>
        </motion.div>

        {/* Stats */}
        {event.distance && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-4 gap-2 py-4 border-b border-border">
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
              <p className="text-sm font-body font-bold text-foreground">{event.spots_taken}/{event.spots_total}</p>
              <p className="text-[10px] text-muted-foreground font-body">Posti</p>
            </div>
          </motion.div>
        )}

        {/* Description */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="py-4 border-b border-border">
          <h3 className="font-display text-lg font-bold text-foreground mb-2">Descrizione</h3>
          <p className="text-sm font-body text-muted-foreground leading-relaxed">{event.description}</p>
        </motion.div>

        {/* Meeting Points */}
        {event.meeting_points && event.meeting_points.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="py-4 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground mb-3">Punti di Ritrovo</h3>
            <div className="space-y-3">
              {event.meeting_points.map((mp) => (
                <button key={mp.id} onClick={() => openDirections(mp.location)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 text-left">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-semibold text-foreground">{mp.name}</p>
                    <p className="text-xs font-body text-muted-foreground">{mp.location} · {mp.time?.slice(0, 5)}</p>
                  </div>
                  <Navigation className="h-4 w-4 text-secondary flex-shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Participants */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold text-foreground">Partecipanti</h3>
            <span className="text-sm font-body text-muted-foreground">{event.spots_taken} / {event.spots_total}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted mb-3">
            <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${Math.min(100, (event.spots_taken / event.spots_total) * 100)}%` }} />
          </div>
          {user && participants && participants.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {participants.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-body">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                    {p.profiles?.first_name?.[0] || "?"}
                  </span>
                  <span className="text-foreground">{p.profiles?.first_name}</span>
                </div>
              ))}
              {participants.length > 5 && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-sm font-body text-muted-foreground">
                  +{participants.length - 5} altri <ChevronRight className="h-3 w-3" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm font-body text-muted-foreground">
              {user ? "Nessun partecipante ancora" : "Accedi per vedere i partecipanti"}
            </p>
          )}
        </motion.div>

        {/* Price Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="py-4">
          {event.payment_type === "deposit" && event.deposit && (
            <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 mb-4">
              <p className="text-sm font-body font-semibold text-foreground">Pagamento con acconto</p>
              <p className="text-xs font-body text-muted-foreground mt-1">
                Acconto: €{event.deposit} · Saldo: €{Number(event.price) - Number(event.deposit)} da pagare in loco
              </p>
            </div>
          )}
          {event.cancellation_policy && (
            <div className="p-3 rounded-xl bg-muted/50 mb-4">
              <p className="text-sm font-body font-semibold text-foreground">Politica di cancellazione</p>
              <p className="text-xs font-body text-muted-foreground mt-1">{event.cancellation_policy}</p>
            </div>
          )}
          {isRegistered && (
            <Button variant="outline" onClick={handleCancel} disabled={cancelMutation.isPending} className="w-full border-destructive text-destructive hover:bg-destructive/10">
              {cancelMutation.isPending ? "Annullamento..." : "Annulla Iscrizione"}
            </Button>
          )}
        </motion.div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border p-4 pb-safe z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-body text-muted-foreground">Prezzo</p>
            <p className="text-xl font-display font-bold text-foreground">
              {Number(event.price) === 0 ? "Gratis" : `€${event.price}`}
            </p>
          </div>
          <Button
            onClick={handleCTA}
            className={`px-8 py-3 rounded-xl font-body font-semibold text-base ${getCTAClass()}`}
            disabled={event.status === "closed" || (isRegistered ? true : false)}
          >
            {getCTALabel()}
          </Button>
        </div>
      </div>

      {/* Registration Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Iscrizione a {event.title}</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Completa l'iscrizione selezionando le opzioni richieste.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {event.meeting_points && event.meeting_points.length > 0 && (
              <div>
                <Label className="font-body text-sm font-semibold">Punto di ritrovo</Label>
                <RadioGroup value={selectedMeetingPoint} onValueChange={setSelectedMeetingPoint} className="mt-2 space-y-2">
                  {event.meeting_points.map((mp) => (
                    <label key={mp.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer">
                      <RadioGroupItem value={mp.id} />
                      <div>
                        <p className="text-sm font-body font-semibold text-foreground">{mp.name}</p>
                        <p className="text-xs font-body text-muted-foreground">{mp.location} · {mp.time?.slice(0, 5)}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {isSportCategory && (
              <div>
                <Label className="font-body text-sm font-semibold">Livello sportivo (opzionale)</Label>
                <Input
                  value={sportLevel}
                  onChange={(e) => setSportLevel(e.target.value)}
                  placeholder="Es: Intermedio, 3.5"
                  className="mt-1"
                />
              </div>
            )}

            {event.payment_type !== "free" && (
              <div className="p-3 rounded-xl bg-gold/10 border border-gold/20">
                <p className="text-sm font-body font-semibold text-foreground">
                  {event.payment_type === "deposit" ? `Acconto: €${event.deposit}` : `Totale: €${event.price}`}
                </p>
                <p className="text-xs font-body text-muted-foreground mt-1">
                  Il pagamento verrà gestito separatamente.
                </p>
              </div>
            )}

            <Button
              onClick={handleRegister}
              disabled={registerMutation.isPending || (event.meeting_points && event.meeting_points.length > 0 && !selectedMeetingPoint)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body font-semibold"
            >
              {registerMutation.isPending ? "Iscrizione in corso..." : "Conferma Iscrizione"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetail;
