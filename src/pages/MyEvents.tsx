import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  CalendarDays, MapPin, Share2, Bookmark, BookmarkCheck, X,
  CalendarPlus, Clock, Calendar, Mail, Loader2, Zap, SquarePen
} from "lucide-react";
import { getRefundInfo, getCancellationDialogMessage, getServiceFeeAmount } from "@/lib/cancellationPolicy";

import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import ShareSheet from "@/components/events/ShareSheet";
import EditRegistrationDialog from "@/components/events/EditRegistrationDialog";
import { useMyEvents, useCancelRegistration, useSavedEvents, useToggleSaveEvent, useUpdateRegistrationDetails } from "@/hooks/useEvents";
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
import { getDepositPaymentLabel, getEventBalancePaymentMode, getRemainingBalanceAmount, isDepositRegistration, isPendingPaymentRegistration } from "@/lib/eventPayments";
import {
  findPriceOptionById,
  getOptionPaymentSummary,
  getOptionPaymentType,
  isOnlinePaymentType,
  isOptionBookable,
} from "@/lib/priceOptions";
import { isEventPastByDate, isEventUpcomingByDate } from "@/lib/eventDates";

const statusStyles: Record<string, string> = {
  iscritto: "bg-success/10 text-success",
  in_attesa: "bg-warning/10 text-warning",
  posto_disponibile: "bg-success/10 text-success",
  partecipato: "bg-primary/10 text-primary",
  pagamento_in_sospeso: "bg-accent/20 text-accent-foreground",
  "Acconto pagato - saldo da completare": "bg-warning/10 text-warning",
  "Acconto pagato - saldo sul posto": "bg-warning/10 text-warning",
};

const statusLabels: Record<string, string> = {
  iscritto: "Iscritto",
  in_attesa: "In lista d'attesa",
  posto_disponibile: "Posto disponibile",
  partecipato: "Partecipato",
  pagamento_in_sospeso: "Pagamento in sospeso",
  "Acconto pagato - saldo da completare": "Acconto pagato - saldo da completare",
  "Acconto pagato - saldo sul posto": "Acconto pagato - saldo sul posto",
};

function getCustomRegistrationFields(event: any): any[] {
  const af = event?.additional_fields as any;
  return af && Array.isArray(af.fields) ? af.fields : [];
}

function hasEditableRegistrationFields(event: any): boolean {
  const hasMeetingPoints = Boolean(event?.meeting_points?.length);
  const carEnabled = Boolean((event?.additional_fields as any)?.car_availability_enabled || (event?.additional_fields as any)?.ask_car_availability);
  return hasMeetingPoints || carEnabled || getCustomRegistrationFields(event).length > 0;
}

function canEditRegistration(event: any): boolean {
  if (!event?.date || !event?.time) return false;
  return parseEventDateTime(event.date, event.time).getTime() > Date.now();
}

function resolveMyEventStatus(registration: any, isPast: boolean): string {
  const event = registration.events;
  if (!event) return "iscritto";
  const selectedPriceOption = findPriceOptionById(event.price_options, registration.price_option_id);

  if (registration.status === "waitlist" && (
    selectedPriceOption
      ? isOptionBookable(selectedPriceOption, event)
      : isOptionBookable(null, event)
  )) {
    return "posto_disponibile";
  }
  if (registration.status === "waitlist") return "in_attesa";

  const depositLabel = getDepositPaymentLabel(registration, event, selectedPriceOption);
  if (depositLabel) return depositLabel;
  if (isPendingPaymentRegistration(registration, event, selectedPriceOption)) return "pagamento_in_sospeso";
  if (isPast && registration.checked_in) return "partecipato";
  if (registration.status === "registered" || registration.status === "paid" || registration.status === "attended") {
    return "iscritto";
  }
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

const invokeAuthenticatedFunction = async (functionName: string, body: Record<string, unknown>) => {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new Error("Devi effettuare l'accesso per completare il checkout.");
  }

  return supabase.functions.invoke(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
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

  const active = registrations?.filter((r: any) => r.status !== "cancelled") || [];
  const upcoming = active.filter((r: any) => isEventUpcomingByDate(r.events?.date));
  const past = active.filter((r: any) => isEventPastByDate(r.events?.date));

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
              <div className="space-y-3 mt-4">{[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
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
              <div className="space-y-3 mt-4">{[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
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
  const updateRegistrationMutation = useUpdateRegistrationDetails();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const navigate = useNavigate();

  const selectedPriceOption = event ? findPriceOptionById(event.price_options, registration.price_option_id) : null;
  const registrationPaymentType = event ? getOptionPaymentType(selectedPriceOption, event) : "free";
  const needsOnlinePayment = isOnlinePaymentType(registrationPaymentType);
  const refundInfo = useMemo(() => {
    if (!event?.date || !event?.time) return null;
    return getRefundInfo(
      event.cancellation_policy,
      event.date,
      event.time,
      0,
      getServiceFeeAmount(registrationPaymentType)
    );
  }, [event?.cancellation_policy, event?.date, event?.time, registrationPaymentType]);
  const cancellationDialogMessage = useMemo(() => getCancellationDialogMessage(refundInfo), [refundInfo]);

  if (!event) return null;

  const resolvedStatus = resolveMyEventStatus(registration, !!isPast);
  const statusLabel = statusLabels[resolvedStatus] || resolvedStatus;
  const statusStyle = statusStyles[resolvedStatus] || statusStyles.iscritto;

  const hasSpotAvailable = resolvedStatus === "posto_disponibile";
  const meetingPoint = registration.meeting_point;
  const displayLocation = event.location_label || event.location;
  const hasPendingPayment = isPendingPaymentRegistration(registration, event, selectedPriceOption);
  const storedBalanceDue = Number(registration.balance_due_amount ?? 0);
  const configuredBalanceDue = getRemainingBalanceAmount(event, selectedPriceOption);
  const hasOnlineBalanceDue = isDepositRegistration(registration)
    && getEventBalancePaymentMode(event, selectedPriceOption) === "online"
    && Math.max(storedBalanceDue, configuredBalanceDue) > 0;
  const canCompletePayment = Boolean(showActions)
    && registration.status !== "cancelled"
    && (hasSpotAvailable || hasPendingPayment || hasOnlineBalanceDue);
  const paymentActionTitle = hasOnlineBalanceDue
    ? "Completa il saldo"
    : hasSpotAvailable
      ? (needsOnlinePayment ? "Completa prenotazione" : "Conferma il posto")
      : "Completa il pagamento";

  const hasPaidPayment = registration.payment_status === "paid" || isDepositRegistration(registration);
  const canCancel = showActions && registration.status !== "cancelled" && !hasSpotAvailable;
  const editableFieldsAvailable = hasEditableRegistrationFields(event);
  const registrationStillEditable = canEditRegistration(event);
  const showEditButton = Boolean(showActions && registration.status !== "cancelled" && editableFieldsAvailable && registrationStillEditable);

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
        toast({ title: t("registrationCancelled"), description: "Prenotazione cancellata con successo. Secondo la policy dell'evento, non è previsto alcun rimborso." });
      } else if (result?.reason === "stripe_error") {
        toast({ title: t("registrationCancelled"), description: "Prenotazione cancellata. Stiamo verificando il rimborso: ti aggiorneremo appena possibile." });
      } else {
        toast({ title: t("registrationCancelled"), description: t("registrationCancelledDesc") });
      }
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const handleCompleteBooking = async () => {
    if (!user) return;

    if (needsOnlinePayment) {
      setPaymentLoading(true);
      try {
        const body: any = { eventId: event.id, registrationId: registration.id };
        const regPriceOptionId = registration.price_option_id;
        if (regPriceOptionId) body.priceOptionId = regPriceOptionId;

        const { data, error } = await invokeAuthenticatedFunction("create-event-checkout", body);
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

  const handleSaveRegistrationDetails = async (payload: {
    meetingPointId?: string;
    carAvailability?: string;
    additionalResponses?: Record<string, string>;
  }) => {
    try {
      await updateRegistrationMutation.mutateAsync({
        registrationId: registration.id,
        eventId: event.id,
        meetingPointId: payload.meetingPointId,
        carAvailability: payload.carAvailability,
        additionalResponses: payload.additionalResponses,
      });
      setShowEditDialog(false);
      toast({ title: "Iscrizione aggiornata con successo" });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
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
              <span className="truncate">{displayLocation}</span>
            </div>
            {meetingPoint && (
              <div className="flex items-center gap-2 mt-0.5 text-xs font-body text-secondary">
                <Clock className="h-3 w-3" />
                <span className="truncate">{meetingPoint.name} · {meetingPoint.time?.slice(0, 5)}</span>
              </div>
            )}
            {(selectedPriceOption || registration.amount_paid || registration.balance_due_amount) && (
              <div className="mt-1.5 text-[11px] font-body text-muted-foreground space-y-0.5">
                {selectedPriceOption && (
                  <p className="truncate">
                    {selectedPriceOption.name} · {getOptionPaymentSummary(selectedPriceOption, event)}
                  </p>
                )}
                {(registration.amount_paid || registration.balance_due_amount) && (
                  <p>
                    {registration.amount_paid ? `Pagato €${Number(registration.amount_paid).toFixed(2)}` : ""}
                    {registration.balance_due_amount ? `${registration.amount_paid ? " · " : ""}Saldo €${Number(registration.balance_due_amount).toFixed(2)}` : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        </Link>

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

            {showEditButton && (
              <button
                onClick={() => setShowEditDialog(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-body font-medium hover:bg-muted/80 active:scale-95 transition-all"
              >
                <SquarePen className="h-3.5 w-3.5" /> Modifica iscrizione
              </button>
            )}

            {canCompletePayment && (
              <button
                onClick={handleCompleteBooking}
                disabled={paymentLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-body font-semibold hover:bg-primary/90 active:scale-95 transition-all ml-auto"
              >
                {paymentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {paymentActionTitle}
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-body font-medium hover:bg-destructive/20 active:scale-95 transition-all ${canCompletePayment ? "" : "ml-auto"}`}
              >
                <X className="h-3.5 w-3.5" /> {t("cancel")}
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogDescription className="font-body text-sm">
              <span className="block font-display text-lg font-semibold text-foreground">Cancelli la tua partecipazione?</span>
              <span className="block mt-2 font-semibold text-foreground">{event.title}</span>
              {hasPaidPayment && cancellationDialogMessage && (
                <span className="block mt-3 text-sm whitespace-pre-line text-foreground">
                  {cancellationDialogMessage}
                </span>
              )}
              {!hasPaidPayment && (
                <span className="block mt-3 text-sm text-foreground">
                  La tua iscrizione verrà annullata.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 font-body" onClick={() => setShowCancelDialog(false)}>
              Ci penso
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-body"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("cancelling")}...</> : "Cancella iscrizione"}
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

      <EditRegistrationDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        event={event}
        registration={registration}
        isSubmitting={updateRegistrationMutation.isPending}
        onSave={handleSaveRegistrationDetails}
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
  const isPast = isEventPastByDate(event.date);
  const displayLocation = event.location_label || event.location;

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
            <span className="truncate">{displayLocation}</span>
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
