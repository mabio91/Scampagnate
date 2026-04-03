import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  CalendarDays, MapPin, Share2, Bookmark, BookmarkCheck, X,
  CalendarPlus, ChevronRight, Clock, Calendar, Mail, Loader2, Zap
} from "lucide-react";
import { getRefundInfo } from "@/lib/cancellationPolicy";

import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import ShareSheet from "@/components/events/ShareSheet";
import { useMyEvents, useCancelRegistration, useSavedEvents, useToggleSaveEvent } from "@/hooks/useEvents";
import OptimizedImage from "@/components/OptimizedImage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { parseEventDateTime } from "@/lib/timezone";

// Status styles for My Events cards — using spec-defined labels
const statusStyles: Record<string, string> = {
  iscritto: "bg-success/10 text-success",
  in_attesa: "bg-warning/10 text-warning",
  posto_disponibile: "bg-success/10 text-success",
  partecipato: "bg-primary/10 text-primary",
  pagamento_in_sospeso: "bg-accent/20 text-accent-foreground",
};

const statusLabels: Record<string, string> = {
  iscritto: "Iscritto",
  in_attesa: "In attesa",
  posto_disponibile: "Posto disponibile",
  partecipato: "Partecipato",
  pagamento_in_sospeso: "Pagamento in sospeso",
};

function isPendingPaymentRegistration(registration: any): boolean {
  const event = registration?.events;
  const isPaymentEvent = event?.payment_type === "paid" || event?.payment_type === "deposit";
  if (!isPaymentEvent) return false;
  if (registration.status === "pending_payment") return true;
  return registration.status === "registered" && registration.payment_status === "pending";
}

/**
 * Resolve user-facing status label for My Events cards.
 * Priority: Pagamento in sospeso > Partecipato > Iscritto > Posto disponibile > In attesa
 */
function resolveMyEventStatus(registration: any, isPast: boolean): string {
  const event = registration.events;
  if (!event) return "iscritto";

  if (isPendingPaymentRegistration(registration)) return "pagamento_in_sospeso";
  
  // Past event + checked in → Partecipato
  if (isPast && registration.checked_in) return "partecipato";
  
  // Iscritto (registered/paid with confirmed payment or free)
  if (registration.status === "registered" || registration.status === "paid" || registration.status === "attended") {
    return "iscritto";
  }
  
  // Waitlist with spot available → Posto disponibile
  if (registration.status === "waitlist" && event.spots_total > 0 && event.spots_taken < event.spots_total) {
    return "posto_disponibile";
  }
  
  // Waitlist → In attesa
  if (registration.status === "waitlist") return "in_attesa";
  
  return "iscritto";
}

const generateCalendarUrl = (event: any, type: "google" | "apple" | "outlook") => {
  const startDate = parseEventDateTime(event.date, event.time);
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

  const title = encodeURIComponent(event.title);
  const location = encodeURIComponent(event.location);
  const eventUrl = `${window.location.origin}/event/${event.id}`;
  const details = encodeURIComponent(`${event.title}\n\nLocation: ${event.location}\n\nEvent page: ${eventUrl}`);

  const formatICS = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const formatGoogle = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  if (type === "google") {
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGoogle(startDate)}/${formatGoogle(endDate)}&location=${location}&details=${details}`;
  }

  if (type === "outlook") {
    return `https://outlook.live.com/calendar/0/action/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${location}&body=${details}`;
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${formatICS(startDate)}`,
    `DTEND:${formatICS(endDate)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location}`,
    `DESCRIPTION:Event page: ${eventUrl}`,
    `URL:${eventUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  return URL.createObjectURL(blob);
};

const MyEvents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: registrations, isLoading } = useMyEvents();
  const { data: savedEvents, isLoading: savedLoading } = useSavedEvents();
  const { t, language } = useLanguage();

  if (!user) {
    return (
      <>
        <div className="px-4 py-12 text-center">
          <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t("myEvents")}</h1>
          <p className="text-muted-foreground font-body text-sm mb-4">{t("signInToViewProfile")}</p>
          <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground font-body">{t("signIn")}</Button>
        </div>
      </>
    );
  }

  const now = new Date();
  // Only show active registrations (not cancelled) — spec: cancelled events disappear from My Events
  const active = registrations?.filter((r: any) => r.status !== "cancelled") || [];
  const upcoming = active.filter((r: any) => new Date(r.events?.date) >= now);
  const past = active.filter((r: any) => new Date(r.events?.date) < now);

  return (
    <>
      <div className="px-4 py-4">
        <h1 className="font-display text-2xl font-bold text-foreground mb-4">{t("myEvents")}</h1>
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full">
            <TabsTrigger value="upcoming" className="flex-1 font-body">{t("upcoming")} ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past" className="flex-1 font-body">{t("past")} ({past.length})</TabsTrigger>
            <TabsTrigger value="saved" className="flex-1 font-body">
              <Bookmark className="h-3 w-3 mr-1" /> {t("saved")} ({savedEvents?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {isLoading ? (
              <div className="space-y-3 mt-4">{[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground font-body text-sm">{t("noUpcomingEvents")}</p>
                <Button variant="outline" className="mt-3 font-body" onClick={() => navigate("/")}>{t("browseEvents")}</Button>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {upcoming.map((r: any) => (
                  <EventRegistrationCard key={r.id} registration={r} showActions />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {past.length === 0 ? (
              <p className="text-center text-muted-foreground font-body py-8 text-sm">{t("noPastEvents")}</p>
            ) : (
              <div className="space-y-3 mt-4">
                {past.map((r: any) => (
                  <EventRegistrationCard key={r.id} registration={r} isPast />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved">
            {savedLoading ? (
              <div className="space-y-3 mt-4">{[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            ) : !savedEvents || savedEvents.length === 0 ? (
              <div className="text-center py-8">
                <Bookmark className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-body text-sm">{t("noSavedEvents")}</p>
                <p className="text-muted-foreground font-body text-xs mt-1">{t("tapBookmark")}</p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {savedEvents.map((se: any) => (
                  <SavedEventCard key={se.id} savedEvent={se} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

const EventRegistrationCard = ({ registration, showActions, isPast }: { registration: any; showActions?: boolean; isPast?: boolean }) => {
  const event = registration.events;
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const cancelMutation = useCancelRegistration();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const navigate = useNavigate();

  if (!event) return null;

  // Resolve status using centralized logic
  const resolvedStatus = resolveMyEventStatus(registration, !!isPast);
  const statusLabel = statusLabels[resolvedStatus] || resolvedStatus;
  const statusStyle = statusStyles[resolvedStatus] || statusStyles.iscritto;

  // Waitlist spot availability detection
  const isWaitlisted = registration.status === "waitlist";
  const hasSpotAvailable = resolvedStatus === "posto_disponibile";
  const needsOnlinePayment = event.payment_type === "paid" || event.payment_type === "deposit";

  const meetingPoint = registration.meeting_point;

  // Policy-based refund info
  const refundInfo = useMemo(() => {
    if (!event.date || !event.time) return null;
    return getRefundInfo(event.cancellation_policy, event.date, event.time);
  }, [event.cancellation_policy, event.date, event.time]);

  const hasPaidPayment = registration.payment_status === "paid";
  const canCancel = showActions && registration.status !== "cancelled" && !hasSpotAvailable;

  const eventUrl = `${window.location.origin}/event/${event.id}`;
  const shareText = `${event.title} - ${new Date(event.date).toLocaleDateString(language === "it" ? "it-IT" : "en-US")}`;
  const shareEvent = () => setShowShareSheet(true);

  const handleCancel = async () => {
    try {
      const result = await cancelMutation.mutateAsync(event.id);
      setShowCancelDialog(false);
      if (result?.refunded) {
        toast({ title: t("registrationCancelled"), description: "Prenotazione cancellata con successo. Riceverai il rimborso nei prossimi giorni." });
      } else if (result?.reason === "no_refund_policy") {
        toast({ title: t("registrationCancelled"), description: "Prenotazione cancellata. Secondo la policy dell'evento, non è previsto alcun rimborso." });
      } else if (result?.reason === "stripe_error") {
        toast({ title: t("registrationCancelled"), description: "Prenotazione cancellata. Stiamo verificando il rimborso: ti aggiorneremo appena possibile." });
      } else {
        toast({ title: t("registrationCancelled"), description: t("registrationCancelledDesc") });
      }
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  // Handle "Completa prenotazione" for waitlisted users when spot is available
  const handleCompleteBooking = async () => {
    if (!user) return;
    
    if (needsOnlinePayment) {
      setPaymentLoading(true);
      try {
        const body: any = { eventId: event.id, registrationId: registration.id };
        const regPriceOptionId = registration.price_option_id;
        if (regPriceOptionId) body.priceOptionId = regPriceOptionId;
        
        const { data, error } = await supabase.functions.invoke("create-event-checkout", { body });
        if (error) throw error;
        if (data?.free) {
          toast({ title: "Pagamento completato", description: "Lo sconto ha coperto l'intero importo!" });
          setPaymentLoading(false);
          window.location.reload();
          return;
        }
        if (data?.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
      } catch (err: any) {
        toast({ title: "Errore", description: err.message, variant: "destructive" });
        setPaymentLoading(false);
      }
    } else {
      // Free/location events — navigate to event detail to complete
      navigate(`/event/${event.id}`);
    }
  };

  const handleCalendarDownload = (type: "google" | "apple" | "outlook") => {
    const url = generateCalendarUrl(event, type);
    if (type === "apple") {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event.title}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <>
      <div className="rounded-xl bg-card overflow-hidden">
        <Link to={`/event/${event.id}`} className="flex gap-3 p-3">
          <OptimizedImage src={event.image_url} alt={event.title} width={80} height={80} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-muted" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-foreground truncate">{event.title}</h3>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold ${statusStyle}`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground text-xs font-body">
              <CalendarDays className="h-3 w-3" />
              {new Date(event.date).toLocaleDateString(language === "it" ? "it-IT" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
              <span>· {event.time?.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-muted-foreground text-xs font-body">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{event.location}</span>
            </div>
            {meetingPoint && (
              <div className="flex items-center gap-2 mt-0.5 text-xs font-body text-secondary">
                <Clock className="h-3 w-3" />
                <span className="truncate">{meetingPoint.name} · {meetingPoint.time?.slice(0, 5)}</span>
              </div>
            )}
          </div>
        </Link>

        {/* Quick Actions */}
        {(showActions || isPast) && registration.status !== "cancelled" && (
          <div className="flex items-center gap-2 px-3 pb-3 pt-1 flex-wrap">
            <button onClick={shareEvent} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-body font-medium hover:bg-muted/80 active:scale-95 transition-all">
              <Share2 className="h-3.5 w-3.5" /> {t("share")}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-body font-medium hover:bg-muted/80 active:scale-95 transition-all">
                  <CalendarPlus className="h-3.5 w-3.5" /> {t("calendar")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => handleCalendarDownload("google")} className="font-body text-sm cursor-pointer py-2.5">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> Google Calendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCalendarDownload("apple")} className="font-body text-sm cursor-pointer py-2.5">
                  <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> Apple Calendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCalendarDownload("outlook")} className="font-body text-sm cursor-pointer py-2.5">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" /> Outlook Calendar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Waitlist spot available → "Completa prenotazione" CTA */}
            {hasSpotAvailable && (
              <button
                onClick={handleCompleteBooking}
                disabled={paymentLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-body font-semibold hover:bg-primary/90 active:scale-95 transition-all ml-auto"
              >
                {paymentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Completa prenotazione
              </button>
            )}

            {/* Cancel button — only show when not in "spot available" state */}
            {canCancel && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-body font-medium hover:bg-destructive/20 active:scale-95 transition-all ml-auto"
              >
                <X className="h-3.5 w-3.5" /> {t("cancel")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cancel Confirmation */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
         <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Annulla iscrizione</DialogTitle>
            <DialogDescription className="font-body text-sm">
              {t("cancelRegistrationText", { title: event.title })}
              {hasPaidPayment && refundInfo && (
                <span className={`block mt-2 text-xs font-semibold ${refundInfo.refundEligible ? "text-green-600" : "text-muted-foreground"}`}>
                  {refundInfo.refundEligible
                    ? "💰 Riceverai il rimborso completo nei prossimi giorni."
                    : `⚠️ ${refundInfo.message}`}
                </span>
              )}
              {refundInfo && (
                <span className="block mt-1 text-[11px] text-muted-foreground">
                  Policy: {refundInfo.policyLabel}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 font-body" onClick={() => setShowCancelDialog(false)}>
              {t("keep")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-body"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("cancelling")}...</> : t("cancelRegistration")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ShareSheet
        open={showShareSheet}
        onOpenChange={setShowShareSheet}
        title={event.title}
        url={eventUrl}
        text={shareText}
      />
    </>
  );
};

const SavedEventCard = ({ savedEvent }: { savedEvent: any }) => {
  const event = savedEvent.events;
  const toggleSave = useToggleSaveEvent();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  if (!event) return null;
  const isPast = new Date(event.date) < new Date();

  const handleUnsave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleSave.mutateAsync({ eventId: event.id, isSaved: true });
      toast({ title: t("removedFromSaved") });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  return (
    <Link to={`/event/${event.id}`} className="block">
      <div className="flex gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-colors">
        <OptimizedImage src={event.image_url} alt={event.title} width={80} height={80} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-muted" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-foreground truncate">{event.title}</h3>
            <button onClick={handleUnsave} className="flex-shrink-0 p-1 text-primary hover:text-primary/80">
              <BookmarkCheck className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-xs font-body">
            <CalendarDays className="h-3 w-3" />
            {new Date(event.date).toLocaleDateString(language === "it" ? "it-IT" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
            {isPast && <span className="text-destructive text-[10px]">({t("past")})</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-muted-foreground text-xs font-body">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{event.location}</span>
          </div>
          <div className="mt-1.5">
            <span className="font-body font-bold text-xs text-foreground">
              {Number(event.price) === 0 ? t("free") : `€${event.price}`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MyEvents;
