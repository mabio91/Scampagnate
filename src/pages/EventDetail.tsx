import { useState, useRef, useCallback, useEffect } from "react";
import { isMembershipActive, isMembershipExpired } from "@/lib/membership";
import { useLanguage } from "@/contexts/LanguageContext";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CalendarDays, MapPin, Users, Clock, Mountain,
  Route, Share2, Navigation, ChevronRight, Heart, Bookmark, BookmarkCheck, CalendarPlus,
  Calendar, Apple, Mail, Map, Car, MapPinned, MessageCircle, Phone, User as UserIcon, Loader2, CreditCard, Ticket, Lock, Tag, Sparkles, AlertCircle, ShieldAlert, ChevronDown, X, ZoomIn
} from "lucide-react";
import { parseCancellationPolicy, CANCELLATION_POLICIES, getRefundInfo, getCancellationDialogMessage, getPolicyDefinition, getServiceFeeAmount } from "@/lib/cancellationPolicy";
import { parseEventDateTime } from "@/lib/timezone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEvent, useEventParticipants, useMyRegistration, useRegisterForEvent, useCancelRegistration, useSavedEvents, useToggleSaveEvent } from "@/hooks/useEvents";
import { useCheckEventAccessRules, getExclusivityIndicators, type AccessRulesConfig } from "@/hooks/useEventAccessRules";
import { usePricingEligibility, getBestUserPrice, type PriceOption, type ResolvedPriceOption } from "@/hooks/usePricingEligibility";
import { BadgeIcon as BadgeIconComp } from "@/components/BadgeIcon";
import DynamicIcon from "@/components/DynamicIcon";
import ShareSheet from "@/components/events/ShareSheet";
import { DifficultyBadge } from "@/components/events/DifficultyBadge";
import { DifficultyGuideDialog } from "@/components/events/DifficultyGuideDialog";
import { CapacityWarning } from "@/components/events/CapacityWarning";
import { WeatherForecast } from "@/components/events/WeatherForecast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import OptimizedImage, { resolveEventImageSrc } from "@/components/OptimizedImage";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

import RegistrationCheckoutDialog from "@/components/events/RegistrationCheckoutDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import useEmblaCarousel from "embla-carousel-react";
import { useEventFitScore } from "@/hooks/useEventFitScore";
import EventFitScore from "@/components/events/EventFitScore";
import { resolveEventBadges } from "@/lib/eventBadges";
import { getDeterministicEventClosingSentence } from "@/lib/eventClosingSentences";
import { getDepositPaymentLabel, getEventBalancePaymentMode, isDepositRegistration, isPendingPaymentRegistration } from "@/lib/eventPayments";

const DescriptionSection = ({ description, expanded, onToggle }: { description: string; expanded: boolean; onToggle: () => void }) => {
  const textRef = useRef<HTMLDivElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsClamped(el.scrollHeight > el.clientHeight + 2);
    }
  }, [description]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="py-4 border-b border-border">
      <h3 className="font-display text-lg font-bold text-foreground mb-2">L'esperienza</h3>
      <div className="relative">
        <div
          ref={textRef}
          className={`text-sm font-body text-foreground/80 dark:text-foreground/90 leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${!expanded ? "line-clamp-6" : ""}`}
          dangerouslySetInnerHTML={{ __html: description }}
        />
        {isClamped && !expanded && (
          <>
            <div className="absolute bottom-6 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            <button onClick={onToggle} className="relative text-sm font-body font-semibold text-primary mt-1 hover:underline">
              Leggi di più
            </button>
          </>
        )}
        {expanded && isClamped && (
          <button onClick={onToggle} className="text-sm font-body font-semibold text-primary mt-1 hover:underline">
            Mostra meno
          </button>
        )}
      </div>
    </motion.div>
  );
};

const invokeAuthenticatedFunction = async (functionName: string, body: Record<string, unknown>) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessione scaduta. Effettua di nuovo l'accesso.");
  }

  return supabase.functions.invoke(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
};

const EventDetail = () => {
  const { id } = useParams();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { user, profile, isOrganizer, isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: event, isLoading } = useEvent(id!);
  const { data: participants } = useEventParticipants(id!);
  
  // Fallback avatars for anonymous users (RLS blocks event_registrations for anon)
  const { data: publicAvatars } = useQuery({
    queryKey: ["event-public-avatars", id],
    enabled: !!id && !user && (!participants || participants.length === 0),
    queryFn: async () => {
      const { data } = await supabase.rpc("get_event_participant_avatars", { p_event_id: id! });
      return data || [];
    },
  });
  const { data: myRegistration } = useMyRegistration(id!);
  const { data: savedEvents } = useSavedEvents();
  const registerMutation = useRegisterForEvent();
  const cancelMutation = useCancelRegistration();
  const toggleSaveMutation = useToggleSaveEvent();

  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showFitScoreWarning, setShowFitScoreWarning] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showDifficultyGuide, setShowDifficultyGuide] = useState(false);
  const [showAccessWarning, setShowAccessWarning] = useState(false);
  const [isRequestingOverride, setIsRequestingOverride] = useState(false);
  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState("");
  const [sportLevel, setSportLevel] = useState("");
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [selectedPriceOption, setSelectedPriceOption] = useState("");
  
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // New states
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [meetingPointsOpen, setMeetingPointsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showOrganizerContact, setShowOrganizerContact] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationLocation, setNavigationLocation] = useState("");
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Gallery carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({ startIndex: galleryStartIndex });

  useEffect(() => {
    if (emblaApi && showGalleryModal) {
      emblaApi.scrollTo(galleryStartIndex, true);
    }
  }, [emblaApi, showGalleryModal, galleryStartIndex]);
  
  // Hero parallax/fade on scroll
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  
  const handleScroll = useCallback(() => {
    setScrollY(window.scrollY);
  }, []);
  
  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);
  
  const heroHeight = 320;
  const heroOpacity = Math.max(0, 1 - scrollY / (heroHeight * 0.7));
  const heroScale = 1 + scrollY * 0.0005;
  const heroTranslateY = scrollY * 0.4;
  const showStickyHeader = scrollY > heroHeight - 60;

  const eventAccessRules = event?.access_rules as AccessRulesConfig | null;
  const { data: accessData, isLoading: accessLoading } = useCheckEventAccessRules(eventAccessRules, event?.difficulty || null);
  const exclusivityIndicators = getExclusivityIndicators(eventAccessRules);

  // Event Fit Score
  const fitScoreMainCategory =
    (event?.additional_fields as any)?.fit_score_main_category || event?.category?.name || null;
  const fitScoreSecondaryCategories =
    ((event?.additional_fields as any)?.fit_score_secondary_categories as string[] | undefined) || [];
  const fitScore = useEventFitScore(
    eventAccessRules,
    event
      ? {
          difficulty: event.difficulty,
          category: fitScoreMainCategory ? { name: fitScoreMainCategory } : null,
          secondaryCategories: fitScoreSecondaryCategories,
        }
      : null
  );

  // Dynamic pricing eligibility
  const rawPriceOptions = event?.price_options as PriceOption[] | null;
  const { data: resolvedPriceOptions } = usePricingEligibility(rawPriceOptions);
  const bestPrice = getBestUserPrice(resolvedPriceOptions, Number(event?.price || 0));

  // Fetch organizer profile for contact info
  const { data: organizerProfile } = useQuery({
    queryKey: ["organizer-profile", event?.organizer_id],
    queryFn: async () => {
      if (!event?.organizer_id) return null;
      const { data: publicData } = await supabase.rpc("get_public_profile", { profile_id: event.organizer_id });
      const pub = publicData?.[0] || null;
      let phone: string | null = null;
      const { data: fullData } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", event.organizer_id)
        .single();
      if (fullData) phone = fullData.phone;
      return {
        first_name: pub?.first_name || "",
        avatar_url: pub?.avatar_url || null,
        phone,
      };
    },
    enabled: !!event?.organizer_id,
  });

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
        <p className="text-muted-foreground font-body">{t("noEventsFound")}</p>
        <Link to="/" className="text-primary font-body mt-2">{t("returnToHome")}</Link>
      </div>
    );
  }

  const imageSrc = resolveEventImageSrc(event.image_url);
  const isPaymentEvent = event.payment_type === "paid" || event.payment_type === "deposit";
  const isLegacyPendingPayment = !!myRegistration
    && myRegistration.status === "registered"
    && isPaymentEvent
    && myRegistration.payment_status === "pending";
  const hasPendingPayment = !!myRegistration && isPendingPaymentRegistration(myRegistration, event);
  const balancePaymentMode = getEventBalancePaymentMode(event);
  const isDepositPaid = !!myRegistration && isDepositRegistration(myRegistration);
  const hasOnlineBalanceDue = isDepositPaid && balancePaymentMode === "online";
  const depositStatusMessage = myRegistration ? getDepositPaymentLabel(myRegistration, event) : null;
  const isRegistered = !!myRegistration
    && myRegistration.status !== "cancelled"
    && myRegistration.status !== "pending_payment"
    && !isLegacyPendingPayment;
  const isSportCategory = event.category?.name === "Sport & Movimento";
  
  const eventBadges = resolveEventBadges({
    price: Number(event.price),
    payment_type: event.payment_type,
    spots_taken: event.spots_taken,
    spots_total: event.spots_total,
    status: event.status,
    access_rules: event.access_rules,
    event_badges: (event as any).event_badges,
  });
  const isSaved = savedEvents?.some((se: any) => se.event_id === event.id) || false;
  const eventStartDate = parseEventDateTime(event.date, event.time);
  const isEventPast = eventStartDate < new Date();

  const canViewParticipants = !!user && (!!isRegistered || user.id === event.organizer_id || isAdmin);
  const canViewMeetingPoints = !!user && (
    isRegistered ||
    user.id === event.organizer_id ||
    isAdmin
  );

  const handleToggleSave = async () => {
    if (!user) { navigate("/auth"); return; }
    try {
      await toggleSaveMutation.mutateAsync({ eventId: event.id, isSaved });
      toast({ title: isSaved ? "Removed from saved" : "Saved to wishlist" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const generateICSBlob = () => {
    const startDate = new Date(`${event.date}T${event.time}`);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
    const eventUrl = `${window.location.origin}/event/${event.id}`;
    const formatICS = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `DTSTART:${formatICS(startDate)}`, `DTEND:${formatICS(endDate)}`,
      `SUMMARY:${event.title}`, `LOCATION:${event.location}`,
      `DESCRIPTION:Event page: ${eventUrl}`, `URL:${eventUrl}`,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    return URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  };

  const generateWebCalUrl = (type: "google" | "outlook") => {
    const startDate = new Date(`${event.date}T${event.time}`);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
    const title = encodeURIComponent(event.title);
    const location = encodeURIComponent(event.location);
    const eventUrl = `${window.location.origin}/event/${event.id}`;
    const details = encodeURIComponent(`${event.title}\n\nLocation: ${event.location}\n\nEvent page: ${eventUrl}`);
    const formatICS = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    if (type === "google") {
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatICS(startDate)}/${formatICS(endDate)}&location=${location}&details=${details}`;
    }
    return `https://outlook.live.com/calendar/0/action/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${location}&body=${details}`;
  };

  const handleAddToCalendar = (type: "google" | "apple" | "outlook") => {
    if (isMobileDevice()) {
      const url = generateICSBlob();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (type === "apple") {
      const url = generateICSBlob();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      window.open(generateWebCalUrl(type), "_blank");
    }
  };

  const handleCTA = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    // "In arrivo" → show informational toast, don't start booking
    if (event.status === "draft") {
      toast({ title: "In arrivo", description: "Le prenotazioni apriranno a breve.\nTorna presto per assicurarti un posto." });
      return;
    }
    if (isEventPast || event.status === "closed" || event.status === "cancelled" || event.status === "past") return;

    // Waitlisted user with spot available → go directly to payment/checkout
    if (waitlistSpotAvailable) {
      handleWaitlistBooking();
      return;
    }

    // Check hard access rules BEFORE any payment or registration flow
    if (accessData && !accessData.hasAccess) {
      setShowAccessWarning(true);
      return;
    }

    if (needsPayment) {
      handleEventPayment();
      return;
    }

    if (isRegistered) return;

    if (accessData && accessData.softWarnings && accessData.softWarnings.length > 0) {
      setShowAccessWarning(true);
      return;
    }

    // Fit score < 50 requires explicit confirmation
    if (fitScore && !fitScore.hidden && !fitScore.profileIncomplete && fitScore.score < 50) {
      setShowFitScoreWarning(true);
      return;
    }

    setShowRegisterDialog(true);
  };

  // Handle waitlist user completing booking when spot becomes available
  const handleWaitlistBooking = async () => {
    if (!myRegistration) return;
    const needsOnlinePayment = event.payment_type === "paid" || event.payment_type === "deposit";
    
    if (needsOnlinePayment) {
      setPaymentLoading(true);
      try {
        const body: any = { eventId: event.id, registrationId: myRegistration.id };
        const regPriceOptionId = (myRegistration as any).price_option_id;
        if (regPriceOptionId) body.priceOptionId = regPriceOptionId;
        
        const { data, error } = await invokeAuthenticatedFunction("create-event-checkout", body);
        if (error) throw error;
        if (data?.free) {
          toast({ title: "Prenotazione completata!", description: "Il posto è tuo!" });
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
      // Free/location event — check availability first, then update status
      try {
        // Re-fetch event to get current spots
        const { data: freshEvent } = await supabase
          .from("events")
          .select("spots_total, spots_taken")
          .eq("id", event.id)
          .single();
        
        if (!freshEvent || freshEvent.spots_taken >= freshEvent.spots_total) {
          toast({ title: "Posto non disponibile", description: "Il posto è stato preso da un altro partecipante. Resti in lista d'attesa.", variant: "destructive" });
          return;
        }

        await supabase.from("event_registrations")
          .update({ status: "registered" as any, payment_status: event.payment_type === "location" ? "pay_on_location" : "not_required" })
          .eq("id", myRegistration.id)
          .eq("user_id", user!.id);
        toast({ title: "Prenotazione completata!", description: "Il posto è tuo!" });
        // Refetch queries instead of full reload
        window.location.reload();
      } catch (err: any) {
        toast({ title: "Errore", description: err.message, variant: "destructive" });
      }
    }
  };


  const handleMembershipCheckout = async () => {
    setMembershipLoading(true);
    try {
      const { data, error } = await invokeAuthenticatedFunction("create-membership-checkout", { eventId: event.id });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      setMembershipLoading(false);
    }
  };

  const handleEventPayment = async () => {
    if (!myRegistration) return;
    setPaymentLoading(true);
    try {
      const body: any = { eventId: event.id, registrationId: myRegistration.id };
      if (appliedDiscount?.discount_code_id) {
        body.discountCodeId = appliedDiscount.discount_code_id;
      }
      const regPriceOptionId = (myRegistration as any).price_option_id;
      if (regPriceOptionId) {
        body.priceOptionId = regPriceOptionId;
      }
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
  };

  const handleRegister = async (requestApproval = false) => {
    if (!isMembershipActive(profile) && (event.payment_type === "free" || event.payment_type === "location")) {
      await handleMembershipCheckout();
      return;
    }

    const isWaitlist = event.status === "full";
    try {
      const result = await registerMutation.mutateAsync({
        eventId: event.id,
        meetingPointId: selectedMeetingPoint || undefined,
        sportLevel: sportLevel || undefined,
        asWaitlist: isWaitlist,
        requestApproval: requestApproval,
        paymentType: event.payment_type,
        priceOptionId: selectedPriceOption || undefined,
      });
      setShowRegisterDialog(false);
      setShowAccessWarning(false);
      setIsRequestingOverride(false);

      const requiresPayment = !isWaitlist && !requestApproval && (event.payment_type === "paid" || event.payment_type === "deposit");
      if (requiresPayment && result?.registrationId) {
        setPaymentLoading(true);
        try {
          const body: any = { eventId: event.id, registrationId: result.registrationId };
          if (appliedDiscount?.discount_code_id) {
            body.discountCodeId = appliedDiscount.discount_code_id;
          }
          if (selectedPriceOption) {
            body.priceOptionId = selectedPriceOption;
          }
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
          // Checkout failed — clean up the pending registration
          if (result?.registrationId) {
            await supabase.from("event_registrations")
              .update({ status: "cancelled" as any })
              .eq("id", result.registrationId)
              .eq("user_id", user!.id);
          }
          toast({ title: "Errore pagamento", description: err.message, variant: "destructive" });
          setPaymentLoading(false);
        }
        return;
      }

      if (requestApproval) {
        toast({ title: "Richiesta inviata", description: "La tua richiesta è stata inviata all'organizzatore.", duration: 5000 });
      } else if (isWaitlist) {
        toast({ title: "Lista d'attesa", description: `Sarai notificato quando si libererà un posto per ${event.title}` });
      } else {
        toast({ title: "Registrazione confermata", description: `Ti sei iscritto a ${event.title}` });
      }
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };


  // Policy-based refund info for cancel dialog messaging
  const serviceFeeAmount = event ? getServiceFeeAmount(event.payment_type) : 0;
  const refundInfo = event ? getRefundInfo(event.cancellation_policy, event.date, event.time, 0, serviceFeeAmount) : null;
  const cancellationDialogMessage = getCancellationDialogMessage(refundInfo);
  const hasPaidPayment = myRegistration?.payment_status === "paid" || myRegistration?.payment_status === "deposit_paid";

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleCancel = async () => {
    try {
      const result = await cancelMutation.mutateAsync(event.id);
      setShowCancelDialog(false);
      if (result?.refunded) {
        toast({ title: "Iscrizione annullata", description: "Prenotazione cancellata con successo. Riceverai il rimborso nei prossimi giorni." });
      } else if (result?.reason === "no_refund_policy") {
        toast({ title: "Iscrizione annullata", description: "Prenotazione cancellata con successo. Secondo la policy dell'evento, non è previsto alcun rimborso." });
      } else if (result?.reason === "stripe_error") {
        toast({ title: "Iscrizione annullata", description: "Prenotazione cancellata. Stiamo verificando il rimborso: ti aggiorneremo appena possibile." });
      } else {
        toast({ title: "Iscrizione annullata", description: "La tua iscrizione è stata annullata." });
      }
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const needsPayment = !!myRegistration
    && myRegistration.status !== "cancelled"
    && myRegistration.status !== "waitlist"
    && myRegistration.status !== "pending_approval"
    && isPaymentEvent
    && (myRegistration.payment_status === "pending" || hasOnlineBalanceDue);
  const isPendingApproval = myRegistration?.status === "pending_approval";
  const isOnWaitlist = myRegistration?.status === "waitlist";

  // Detect if a spot has become available for a waitlisted user
  const remainingSpots = event.spots_total - event.spots_taken;
  const waitlistSpotAvailable = isOnWaitlist && remainingSpots > 0;
  const availabilityText = remainingSpots <= 0
    ? "Sold out"
    : remainingSpots === 1
      ? "1 posto disponibile"
      : `${remainingSpots} posti disponibili`;
  const showUrgencyBadge = event.spots_total > 0
    && (event.spots_taken / event.spots_total) > 0.7
    && remainingSpots > 0;

  // CTA PRIORITY ORDER (from highest to lowest)
  // Check if user is blocked by hard access rules
  const isBlockedByAccessRules = !!(user && accessData && !accessData.hasAccess && accessData.failedRules.length > 0);
  const blockingMessage = isBlockedByAccessRules
    ? (accessData?.restrictionMessage || accessData?.failedRules?.[0]?.reason || "Non soddisfi i requisiti per partecipare a questo evento.")
    : null;

const getCTALabel = () => {
    if (event.status === "closed") return "Chiuso";
    if (isEventPast || event.status === "cancelled" || event.status === "past") return "Chiuso";
    if (event.status === "draft") return "Partecipa"; // shown as disabled/inactive
    if (!user) return "Partecipa";
    // Waitlisted user with spot available → "Completa prenotazione"
    if (waitlistSpotAvailable) return "Completa prenotazione";
    if (hasOnlineBalanceDue) return "Completa il saldo";
    // Already registered → "Iscritto" (disabled, informational)
    if (isRegistered && !needsPayment && !isOnWaitlist && !isPendingApproval) return "Iscritto ✓";
    if (isPendingApproval) return "In attesa di approvazione";
    // On waitlist with no spot → no action CTA, show informational
    if (isOnWaitlist) return "Sei in lista d'attesa";
    if (isBlockedByAccessRules) return "Requisiti non soddisfatti";
    if (needsPayment) return "Paga ora";
    if (event.status === "full") return "Lista d'attesa";
    return "Partecipa";
  };

  const getCTAClass = () => {
    if (isEventPast || event.status === "closed" || event.status === "cancelled" || event.status === "past") return "bg-muted text-muted-foreground cursor-not-allowed";
    if (event.status === "draft") return "bg-muted text-muted-foreground cursor-not-allowed opacity-60"; // "In arrivo" disabled style
    if (!user) return "bg-primary text-primary-foreground hover:bg-primary/90";
    if (waitlistSpotAvailable) return "bg-primary text-primary-foreground hover:bg-primary/90";
    if (hasOnlineBalanceDue) return "bg-accent text-accent-foreground hover:bg-accent/90";
    if (isRegistered && !needsPayment && !isOnWaitlist && !isPendingApproval) return "bg-success/20 text-success cursor-default";
    if (isPendingApproval) return "bg-warning/20 text-warning border border-warning/30";
    if (isOnWaitlist) return "bg-warning/20 text-warning border border-warning/30 cursor-default";
    if (isBlockedByAccessRules) return "bg-muted text-muted-foreground cursor-not-allowed opacity-70";
    if (needsPayment) return "bg-accent text-accent-foreground hover:bg-accent/90";
    if (event.status === "full") return "bg-secondary text-secondary-foreground hover:bg-secondary/90";
    return "bg-primary text-primary-foreground hover:bg-primary/90";
  };

  const shareEvent = () => setShowShareSheet(true);

  const eventUrl = `${window.location.origin}/event/${event.id}`;
  const shareText = `${event.title} - ${new Date(event.date).toLocaleDateString(language === "it" ? "it-IT" : "en-US", { day: "numeric", month: "short", year: "numeric" })}`;

  const openDirections = (location: string, app: "google" | "apple" | "waze") => {
    const encoded = encodeURIComponent(location);
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
      apple: `https://maps.apple.com/?daddr=${encoded}`,
      waze: `https://waze.com/ul?q=${encoded}&navigate=yes`,
    };
    window.open(urls[app], "_blank");
  };

  // Format date string for display
  const formatDateDisplay = () => {
    const dateObj = new Date(event.date);
    const dayName = dateObj.toLocaleDateString(language === "it" ? "it-IT" : "en-US", { weekday: "long" });
    const dayNum = dateObj.getDate();
    const month = dateObj.toLocaleDateString(language === "it" ? "it-IT" : "en-US", { month: "long" });
    const year = dateObj.getFullYear();
    const startTime = event.time?.slice(0, 5);
    // Check if duration provides end time info
    const durationStr = event.duration;
    let endTime = "";
    if (durationStr) {
      const hoursMatch = durationStr.match(/(\d+)\s*h/i);
      const minsMatch = durationStr.match(/(\d+)\s*m/i);
      if (hoursMatch || minsMatch) {
        const startParts = (startTime || "00:00").split(":").map(Number);
        const totalMins = startParts[0] * 60 + startParts[1] + (hoursMatch ? parseInt(hoursMatch[1]) * 60 : 0) + (minsMatch ? parseInt(minsMatch[1]) : 0);
        const endH = Math.floor(totalMins / 60) % 24;
        const endM = totalMins % 60;
        endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      }
    }
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return {
      dateText: `${capitalize(dayName)}, ${dayNum} ${capitalize(month)} ${year}`,
      timeText: endTime ? `${startTime} – ${endTime}` : startTime || "",
    };
  };

  const { dateText, timeText } = formatDateDisplay();

  // Price display logic (simplified for event page)
  const getPriceDisplay = () => {
    const hasPriceOptions = event.price_options && event.price_options.length > 0;
    if (Number(event.price) === 0 && event.payment_type === "free") return "Gratis";
    if (hasPriceOptions) {
      const prices = event.price_options!.map((o: any) => Number(o.price));
      const minPrice = Math.min(...prices);
      if (prices.length > 1) return `Da €${minPrice.toFixed(0)}`;
      return `€${minPrice.toFixed(0)}`;
    }
    return `€${Number(event.price).toFixed(0)}`;
  };

  // Get cancellation policy short label
  const getCancellationLabel = () => {
    if (!event.cancellation_policy) return null;
    const { policyType } = parseCancellationPolicy(event.cancellation_policy);
    if (!policyType) return null;
    return CANCELLATION_POLICIES[policyType]?.labelIt || null;
  };

  // Get what's included bullets
  const getIncludedItems = () => {
    const items: string[] = [];
    const af = event.additional_fields as any;
    if (af && af.includes && Array.isArray(af.includes)) {
      return af.includes.slice(0, 3);
    }
    return items;
  };

  // remainingSpots already computed above
  const activeParticipantCount = participants ? participants.length : (event.spots_taken || 0);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background pb-36">
      {/* 17. STICKY HEADER ON SCROLL */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 pt-safe ${
          showStickyHeader
            ? "bg-background/95 backdrop-blur-lg shadow-sm border-b border-border/50 translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted transition-colors shrink-0">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h2 className="text-sm font-display font-bold text-foreground truncate">{event.title}</h2>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={handleToggleSave} className="p-2 rounded-full hover:bg-muted transition-colors">
              {isSaved ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5 text-foreground" />}
            </button>
            <button onClick={shareEvent} className="p-2 rounded-full hover:bg-muted transition-colors">
              <Share2 className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>
      {/* 1. HERO with parallax/fade */}
      <div ref={heroRef} className="relative overflow-hidden" style={{ height: `${heroHeight}px` }}>
        <div
          style={{
            opacity: heroOpacity,
            transform: `scale(${heroScale}) translateY(${heroTranslateY}px)`,
            willChange: "transform, opacity",
            position: "absolute",
            inset: 0,
          }}
        >
          <OptimizedImage src={event.image_url} alt={event.title} className="w-full h-full object-cover bg-muted" width={600} height={320} loading="eager" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" style={{ opacity: heroOpacity }} />
        
        {/* Top buttons with Apple safe area */}
        <div className="absolute top-0 left-0 right-0 pt-safe">
          <div className="flex items-center justify-between px-4 pt-3">
            <button onClick={() => navigate(-1)} className="p-2.5 rounded-full bg-background/20 backdrop-blur-md text-primary-foreground touch-target flex items-center justify-center">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex gap-2">
              <button onClick={handleToggleSave} className="p-2.5 rounded-full bg-background/20 backdrop-blur-md text-primary-foreground touch-target flex items-center justify-center">
                {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
              </button>
              <button onClick={shareEvent} className="p-2.5 rounded-full bg-background/20 backdrop-blur-md text-primary-foreground touch-target flex items-center justify-center">
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Title over hero */}
        <div className="absolute bottom-12 left-4 right-4" style={{ opacity: heroOpacity }}>
          {/* Status badge */}
          {(event.status === "full" || event.status === "closed" || event.status === "cancelled" || event.status === "past") && (
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-body font-bold mb-2 ${
              event.status === "full" ? "bg-destructive/90 text-destructive-foreground" :
              event.status === "cancelled" ? "bg-destructive/90 text-destructive-foreground" :
              "bg-muted/90 text-muted-foreground"
            }`}>
              {event.status === "full" ? "Sold Out" : event.status === "closed" ? "Chiuso" : event.status === "cancelled" ? "Annullato" : "Passato"}
            </span>
          )}
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight drop-shadow-lg">{event.title}</h1>
        </div>
      </div>

      {/* 16. Rounded top container overlapping the hero */}
      <div className="relative -mt-6 bg-background rounded-t-3xl z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-2">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            {event.difficulty && (
              <button onClick={() => setShowDifficultyGuide(true)} className="flex items-center hover:opacity-90 transition-opacity">
                <DifficultyBadge difficulty={event.difficulty} />
              </button>
            )}
            {event.category && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-body font-semibold">
                {event.category.icon && <span className="flex items-center justify-center shrink-0"><DynamicIcon value={event.category.icon} size={14} /></span>}
                {event.category.name}
              </span>
            )}
            {eventBadges.map((b) => (
              <span key={b.key} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-bold shadow-sm ${b.className}`}>
                {b.emoji ? `${b.emoji} ` : ""}{b.label}
              </span>
            ))}
            {exclusivityIndicators.map((ind, idx) => (
              <span key={idx} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-semibold ${
                ind.variant === "members" ? "bg-primary/10 text-primary" :
                ind.variant === "exclusive" ? "bg-gold/10 text-gold" :
                ind.variant === "restricted" ? "bg-warning/10 text-warning" :
                "bg-secondary/10 text-secondary"
              }`}>
                {ind.variant === "members" ? "👑 " : ind.variant === "exclusive" ? "⭐ " : ind.variant === "restricted" ? "🔒 " : "✋ "}
                {ind.label}
              </span>
            ))}
            {(isOrganizer || isAdmin) && event.visibility !== "public" && (
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-body font-semibold ${
                event.visibility === 'private' ? 'bg-amber-100/90 text-amber-800' : 'bg-slate-800/80 text-white'
              }`}>
                {event.visibility === 'private' ? '🔗 Private' : '👁️ Hidden'}
              </span>
            )}
          </div>
        </div>

      <div className="max-w-lg mx-auto px-4">

        {/* 2. DATE & LOCATION (WEMEET STYLE) */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-4 border-b border-border">
          {/* Row 1 – Date & Time → tap opens calendar */}
          <button
            onClick={() => setShowCalendarModal(true)}
            className="flex items-start gap-3 mb-3 w-full text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body font-semibold text-foreground capitalize group-hover:text-primary transition-colors">
                {dateText}
              </p>
              <p className="text-xs font-body text-muted-foreground">{timeText}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
          </button>

          {/* Row 2 – Location → tap opens navigation choice modal */}
          <button
            onClick={() => { setNavigationLocation(event.location); setShowNavigationModal(true); }}
            className="flex items-start gap-3 w-full text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body font-semibold text-foreground group-hover:text-secondary transition-colors">{(event as any).location_label || event.location.split(',')[0]}</p>
              <p className="text-xs font-body text-muted-foreground truncate">{event.location}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
          </button>

          {/* Weather inline row */}
          <WeatherForecast 
            location={event.location} 
            date={event.date} 
            overrideCondition={(event.additional_fields as any)?.weather_override_condition || null}
            overrideTempMin={(event.additional_fields as any)?.weather_override_temp_min ?? null}
            overrideTempMax={(event.additional_fields as any)?.weather_override_temp_max ?? null}
            overrideTempAvg={(event.additional_fields as any)?.weather_override_temp_avg ?? null}
            overrideTemp={(event.additional_fields as any)?.weather_override_temp ?? null}
          />
        </motion.div>

        {/* 10. ORGANIZER + 9. PARTICIPANTS (WeMeet style) */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="py-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            {/* Organizer (left) */}
            <div className="flex-shrink-0">
              <p className="text-xs font-body font-semibold text-foreground mb-2">{t("organizer")}</p>
              <button onClick={() => setShowOrganizerContact(true)} className="flex items-center gap-2 group text-left">
                {organizerProfile?.avatar_url ? (
                  <img src={organizerProfile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-body font-bold text-sm">
                    {event.organizer_name?.[0] || "O"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-body font-semibold text-foreground group-hover:text-primary transition-colors">{organizerProfile?.first_name || event.organizer_name}</p>
                  <p className="text-xs font-body text-muted-foreground">Contatta</p>
                </div>
              </button>
            </div>

            {/* Participants (right) */}
            <div className="flex-shrink-0">
              <p className="text-xs font-body font-semibold text-foreground mb-2">Chi c'è? ({activeParticipantCount})</p>
              <button
                onClick={() => navigate(`/event/${event.id}/participants`)}
                className="flex items-center"
              >
                {(() => {
                  const avatarList = participants && participants.length > 0
                    ? participants.slice(0, 3).map((p: any) => ({ id: p.id, avatar_url: p.profiles?.avatar_url, first_name: p.profiles?.first_name }))
                    : publicAvatars && publicAvatars.length > 0
                    ? (publicAvatars as any[]).slice(0, 3).map((p: any) => ({ id: p.user_id, avatar_url: p.avatar_url, first_name: p.first_name }))
                    : [];
                  const totalCount = activeParticipantCount;

                  return avatarList.length > 0 ? (
                    <div className="flex items-center">
                      <div className="flex -space-x-2.5">
                        {avatarList.map((p: any, idx: number) => (
                          <div key={p.id} className="relative" style={{ zIndex: 3 - idx }}>
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-background" />
                            ) : (
                              <span className="w-9 h-9 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-semibold text-primary">
                                {p.first_name?.[0] || "?"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {totalCount > 3 && (
                        <span className="w-9 h-9 -ml-2.5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-body font-bold text-muted-foreground z-0">
                          +{totalCount - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-body text-muted-foreground">
                      {activeParticipantCount > 0 ? `${activeParticipantCount} iscritti` : "Nessun iscritto"}
                    </span>
                  );
                })()}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        {(event.distance || event.elevation || event.duration) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`grid gap-2 py-4 border-b border-border`} style={{ gridTemplateColumns: `repeat(${[event.distance, event.elevation, event.duration, true].filter(Boolean).length}, 1fr)` }}>
            {event.distance && (
              <div className="text-center">
                <Route className="h-5 w-5 mx-auto text-secondary mb-1" />
                <p className="text-sm font-body font-bold text-foreground">{event.distance}</p>
                <p className="text-[10px] text-muted-foreground font-body">{t("distance")}</p>
              </div>
            )}
            {event.elevation && (
              <div className="text-center">
                <Mountain className="h-5 w-5 mx-auto text-secondary mb-1" />
                <p className="text-sm font-body font-bold text-foreground">{event.elevation}</p>
                <p className="text-[10px] text-muted-foreground font-body">{t("elevation")}</p>
              </div>
            )}
            {event.duration && (
              <div className="text-center">
                <Clock className="h-5 w-5 mx-auto text-secondary mb-1" />
                <p className="text-sm font-body font-bold text-foreground">{event.duration}</p>
                <p className="text-[10px] text-muted-foreground font-body">{t("duration")}</p>
              </div>
            )}
            <div className="text-center">
              <Users className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{activeParticipantCount}/{event.spots_total}</p>
              <p className="text-[10px] text-muted-foreground font-body">{t("spots")}</p>
            </div>
          </motion.div>
        )}




        {/* 4. DESCRIPTION → "L'esperienza" with gradient fade */}
        <DescriptionSection description={event.description} expanded={descriptionExpanded} onToggle={() => setDescriptionExpanded(v => !v)} />

        {/* Safety Warning for demanding events */}
        {user && profile && event.difficulty && parseInt(event.difficulty) >= 3 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="py-3">
            {(() => {
              const diffLevel = parseInt(event.difficulty);
              const selfLevel = profile.self_level;
              const trekkingExp = (profile as any).trekking_experience;
              const activityFreq = (profile as any).activity_frequency;
              
              const isUnderprepared = (() => {
                if (diffLevel >= 4) {
                  return selfLevel !== "advanced" || (trekkingExp !== "5_plus" && trekkingExp !== "5+") || (activityFreq !== "high" && activityFreq !== ">2/week");
                }
                if (diffLevel === 3) {
                  return selfLevel === "beginner" || activityFreq === "low" || activityFreq === "rarely";
                }
                return false;
              })();

              if (!isUnderprepared) return null;

              return (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-body font-semibold text-foreground mb-0.5">
                      {diffLevel >= 4 ? "Evento impegnativo" : "Evento di media difficoltà"}
                    </p>
                    <p className="text-xs font-body text-muted-foreground leading-relaxed">
                      {diffLevel >= 4
                        ? "Questo evento richiede esperienza avanzata e ottima preparazione fisica. Valuta il tuo livello prima di iscriverti."
                        : "Questo evento richiede una preparazione fisica di base e un po' di esperienza. Controlla i dettagli prima di iscriverti."}
                    </p>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* 5. GALLERY → click opens fullscreen */}
        {event.gallery_images && event.gallery_images.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="py-4 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground mb-3">{t("gallery")}</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {event.gallery_images.sort((a: any, b: any) => a.order - b.order).map((img: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => { setGalleryStartIndex(idx); setShowGalleryModal(true); }}
                  className="relative aspect-square w-[140px] sm:w-[180px] rounded-xl overflow-hidden bg-muted group cursor-pointer shadow-md active:scale-95 transition-all flex-shrink-0"
                >
                  <OptimizedImage 
                    src={img.url} 
                    alt={`Gallery ${idx + 1}`} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    width={180} 
                    height={180}
                  />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* 6. EQUIPMENT – Collapsible (default CLOSED), amber for mandatory */}
        {event.equipment_list && Array.isArray(event.equipment_list) && (event.equipment_list as any[]).length > 0 && (() => {
          const allItems = event.equipment_list as any[];
          const mandatoryItems = allItems.filter((item: any) => item.is_mandatory);
          const recommendedItems = allItems.filter((item: any) => !item.is_mandatory);
          const hasMandatory = mandatoryItems.length > 0;

          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="py-4 border-b border-border">
              <Collapsible open={equipmentOpen} onOpenChange={setEquipmentOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <h3 className="font-display text-lg font-bold text-foreground">{t("equipment")}</h3>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${equipmentOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  {/* Mandatory Equipment – amber/orange */}
                  {hasMandatory && (
                    <div className="mb-4">
                      <p className="text-xs font-body font-bold text-amber-600 uppercase tracking-wider mb-2">{t("mandatoryEquipment")}</p>
                      <div className="space-y-2">
                        {mandatoryItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm font-body">
                            <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center text-[10px] font-bold">!</span>
                            <div>
                              <span className="font-semibold text-foreground">{item.name}</span>
                              {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Equipment */}
                  {recommendedItems.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("recommendedEquipment")}</p>
                      <div className="space-y-2">
                        {recommendedItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm font-body">
                            <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold">·</span>
                            <div>
                              <span className="text-muted-foreground">{item.name}</span>
                              {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 7. SAFETY NOTICE (inside equipment) */}
                  {hasMandatory && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs font-body text-foreground leading-relaxed">
                        <strong>Avviso importante</strong><br />
                        I partecipanti che si presentano senza l'attrezzatura obbligatoria potrebbero non essere ammessi all'attività per motivi di sicurezza.
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          );
        })()}

        {/* 8. MEETING POINTS – collapsible */}
        {canViewMeetingPoints && event.meeting_points && event.meeting_points.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="py-4 border-b border-border">
            <Collapsible open={meetingPointsOpen} onOpenChange={setMeetingPointsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h3 className="font-display text-lg font-bold text-foreground">{t("meetingPoints")}</h3>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${meetingPointsOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-2">
                  {event.meeting_points.map((mp: any) => (
                    <button
                      key={mp.id}
                      onClick={() => { setNavigationLocation(mp.location); setShowNavigationModal(true); }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 w-full text-left hover:bg-muted transition-colors group"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-secondary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-body font-semibold text-foreground truncate">{mp.name}</p>
                        <p className="text-xs font-body text-muted-foreground truncate">{mp.location}</p>
                        {mp.notes && (
                          <p className="text-xs font-body text-muted-foreground/90 mt-0.5 break-words">
                            {mp.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-body font-bold text-foreground">{mp.time?.slice(0, 5)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </motion.div>
        )}

        {/* REGOLE & INFO – collapsible, dynamic based on cancellation policy */}
        {(() => {
          const closingSentence =
            (event.additional_fields as any)?.closing_sentence ||
            getDeterministicEventClosingSentence(event.id);

          const policy = getPolicyDefinition(event.cancellation_policy);
          const isFlexible = policy.type !== "non_refundable";
          const bullets = event.payment_type === "free"
            ? [
                { icon: "✅", text: "Puoi disdire in qualsiasi momento direttamente dall'app" },
                { icon: "⚠️", text: "Se non puoi più venire, libera il posto il prima possibile" },
                { icon: "🔁", text: "I posti liberati vengono assegnati alla lista d'attesa" },
                { icon: "❌", text: "Chi non si presenta senza disdire potrà avere limitazioni sugli eventi futuri" },
                { icon: "🤝", text: "Qui si viene per stare bene: rispetto per il gruppo prima di tutto" },
                { icon: "✨", text: closingSentence },
              ]
            : isFlexible
              ? [
                  { icon: "✔️", text: "Se dobbiamo annullare noi (es. maltempo), ti rimborsiamo tutto — senza stress" },
                  { icon: "✔️", text: `Se cambi idea, puoi disdire fino a ${policy.requiredHours}h prima dell'evento` },
                  { icon: "ℹ️", text: "In questo caso riceverai il rimborso dell'importo versato, escluso il costo del servizio di 1€" },
                  { icon: "🤝", text: "Qui si viene per stare bene: rispetto, puntualità e voglia di condividere" },
                  { icon: "✨", text: closingSentence },
                ]
              : [
                  { icon: "✔️", text: "Se dobbiamo annullare noi (es. maltempo), ti rimborsiamo tutto — senza stress" },
                  { icon: "❌", text: "Questo evento non è rimborsabile in caso di cancellazione" },
                  { icon: "💡", text: "Organizziamo tutto in anticipo per garantire l'esperienza" },
                  { icon: "🤝", text: "Qui si viene per stare bene: rispetto, puntualità e voglia di condividere" },
                  { icon: "✨", text: closingSentence },
                ];

          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="py-4 border-b border-border">
              <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
                <CollapsibleTrigger className="flex items-start justify-between w-full group text-left">
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">Regole & Info</h3>
                    {event.payment_type !== "free" && policy.shortInfoLabelIt && (
                      <p className="text-xs font-body text-muted-foreground mt-0.5">
                        {policy.shortInfoLabelIt}
                      </p>
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 mt-1 ${rulesOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <ul className="space-y-2.5">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm font-body text-foreground/80 dark:text-foreground/90 leading-relaxed">
                        {b.icon && <span className="shrink-0">{b.icon}</span>}
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          );
        })()}

        {/* Event Fit Score — "Quanto fa per te" */}
        {user && !accessData?.failedRules?.length && !fitScore.hidden && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="pt-4 pb-3">
            <h3 className="font-display text-lg font-bold text-foreground mb-3">Quanto fa per te</h3>
            <EventFitScore fitScore={fitScore} />
          </motion.div>
        )}

        {/* Price section removed — price only shown in bottom sticky bar */}

        {/* Actions for registered users */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={isRegistered && !hasPendingPayment ? "pt-3" : "hidden"}>
          {isRegistered && !hasPendingPayment && (
            <Button variant="outline" onClick={handleCancelClick} disabled={cancelMutation.isPending} className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20">
              {cancelMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Annullamento...</> : "Annulla iscrizione"}
            </Button>
          )}

          {/* Cancel Confirmation Dialog */}
          <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display">Annulla iscrizione</DialogTitle>
                <DialogDescription className="font-body text-sm">
                  <span className="block">Cancelli la tua partecipazione?</span>
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
                  {refundInfo && (
                    <span className="block mt-1 text-[11px] text-muted-foreground">
                      Policy: {refundInfo.policyLabel}
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
                  {cancelMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Annullamento...</> : "Cancella iscrizione"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
      </div> {/* end rounded top container */}

      {/* 12. STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
        {/* Blocking message above the bar */}
        {isBlockedByAccessRules && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
            <p className="text-xs text-destructive font-body text-center leading-tight">
              {blockingMessage}
            </p>
          </div>
        )}
        <div className="max-w-lg mx-auto flex items-end justify-between gap-3 p-3 pb-safe">
          <div className="min-w-0 flex-1">
            {/* Price display */}
            <div className="flex items-baseline gap-1.5">
              {appliedDiscount && needsPayment ? (
                <>
                  <p className="text-sm font-display text-muted-foreground line-through">€{Number(appliedDiscount.original_price).toFixed(0)}</p>
                  <p className="text-lg font-display font-bold text-green-600">€{Number(appliedDiscount.final_price).toFixed(0)}</p>
                </>
              ) : (
                <p className="text-lg font-display font-bold text-foreground">{getPriceDisplay()}</p>
              )}
            </div>
            <span className="text-xs font-body text-muted-foreground">{availabilityText}</span>
            {depositStatusMessage && (
              <p className={`text-[11px] font-body mt-1 ${hasOnlineBalanceDue ? "text-warning" : "text-muted-foreground"}`}>
                {depositStatusMessage}
              </p>
            )}
            {false && (
              <span className="text-[11px] font-body font-bold text-white bg-black dark:bg-white dark:text-black px-2 py-0.5 rounded-full">
                🔥 ULTIMI POSTI RIMASTI!
              </span>
            )}
            {/* Registration deadline (if applicable) */}
            {event.additional_fields && (event.additional_fields as any).registration_deadline && (
              <p className="text-[10px] font-body text-muted-foreground">
                Iscrizioni fino al {new Date((event.additional_fields as any).registration_deadline).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
            )}
          </div>
          <div className="relative shrink-0 pt-5">
            {showUrgencyBadge && (
              <span className="pointer-events-none absolute right-2 top-0 z-10 rounded-full bg-black px-2.5 py-1 text-[11px] font-body font-bold text-white shadow-sm dark:bg-white dark:text-black">
                Ultimi posti!
              </span>
            )}
          <Button
            onClick={handleCTA}
            className={`px-6 py-3 rounded-xl font-body font-semibold text-sm shrink-0 ${getCTAClass()}`}
            disabled={
              paymentLoading ||
              isEventPast ||
              event.status === "closed" || event.status === "cancelled" || event.status === "past" ||
              (!!user && isRegistered && !needsPayment && !isOnWaitlist && !isPendingApproval && !waitlistSpotAvailable) ||
              (!!user && isOnWaitlist && !waitlistSpotAvailable) ||
              (isBlockedByAccessRules && !waitlistSpotAvailable)
            }
          >
            {paymentLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Attendere...</>
            ) : getCTALabel()}
          </Button>
          </div>
        </div>
      </div>

      {/* ══════════════════ MODALS ══════════════════ */}

      {/* 5. Gallery Fullscreen Modal */}
      <AnimatePresence>
        {showGalleryModal && event.gallery_images && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="flex items-center justify-end p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
              <button onClick={() => setShowGalleryModal(false)} className="p-2 rounded-full bg-white/10 text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden" ref={emblaRef}>
              <div className="flex h-full">
                {event.gallery_images.sort((a: any, b: any) => a.order - b.order).map((img: any, idx: number) => (
                  <div key={idx} className="flex-[0_0_100%] min-w-0 flex items-center justify-center p-4">
                    <img
                      src={img.url}
                      alt={`Gallery ${idx + 1}`}
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 10. Organizer Contact Panel */}
      <Dialog open={showOrganizerContact} onOpenChange={setShowOrganizerContact}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">{organizerProfile?.first_name || event.organizer_name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {organizerProfile?.avatar_url ? (
              <img src={organizerProfile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-body font-bold text-2xl">
                {event.organizer_name?.[0] || "O"}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start font-body"
              onClick={() => { setShowOrganizerContact(false); navigate(`/organizer/${event.organizer_id}`); }}
            >
              <UserIcon className="h-4 w-4 mr-3" /> Profilo
            </Button>
            {organizerProfile?.phone && (
              <>
                <Button
                  variant="outline"
                  asChild
                  className="w-full justify-start font-body"
                >
                  <a
                    href={`https://wa.me/${organizerProfile.phone.replace(/[^0-9+]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-4 w-4 mr-3" /> WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start font-body"
                >
                  <a href={`tel:${organizerProfile.phone}`}>
                    <Phone className="h-4 w-4 mr-3" /> Telefona
                  </a>
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation Choice Modal */}
      <Dialog open={showNavigationModal} onOpenChange={setShowNavigationModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Apri con</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start font-body"
              onClick={() => { openDirections(navigationLocation, "google"); setShowNavigationModal(false); }}
            >
              <MapPinned className="h-4 w-4 mr-3" /> Google Maps
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start font-body"
              onClick={() => { openDirections(navigationLocation, "apple"); setShowNavigationModal(false); }}
            >
              <Map className="h-4 w-4 mr-3" /> Apple Maps
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start font-body"
              onClick={() => { openDirections(navigationLocation, "waze"); setShowNavigationModal(false); }}
            >
              <Car className="h-4 w-4 mr-3" /> Waze
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar Choice Modal */}
      <Dialog open={showCalendarModal} onOpenChange={setShowCalendarModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Aggiungi al calendario</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start font-body"
              onClick={() => { handleAddToCalendar("google"); setShowCalendarModal(false); }}
            >
              <Calendar className="h-4 w-4 mr-3" /> Google Calendar
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start font-body"
              onClick={() => { handleAddToCalendar("apple"); setShowCalendarModal(false); }}
            >
              <Apple className="h-4 w-4 mr-3" /> Apple Calendar
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start font-body"
              onClick={() => { handleAddToCalendar("outlook"); setShowCalendarModal(false); }}
            >
              <Mail className="h-4 w-4 mr-3" /> Outlook
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RegistrationCheckoutDialog
        open={showRegisterDialog}
        onOpenChange={setShowRegisterDialog}
        event={event}
        resolvedPriceOptions={resolvedPriceOptions}
        onRegister={async (opts) => {
          // Set state from dialog choices
          if (opts.appliedDiscount) setAppliedDiscount(opts.appliedDiscount);
          if (opts.priceOptionId) setSelectedPriceOption(opts.priceOptionId);

          // Check membership for free/location events
          if (!isMembershipActive(profile) && (event.payment_type === "free" || event.payment_type === "location")) {
            await handleMembershipCheckout();
            return;
          }

          const isWaitlist = event.status === "full";
          try {
            const result = await registerMutation.mutateAsync({
              eventId: event.id,
              meetingPointId: opts.meetingPointId,
              sportLevel: opts.sportLevel,
              carAvailability: opts.carAvailability,
              additionalResponses: opts.additionalResponses,
              asWaitlist: isWaitlist,
              requestApproval: opts.requestApproval,
              paymentType: event.payment_type,
              priceOptionId: opts.priceOptionId,
            });
            setShowRegisterDialog(false);
            setShowAccessWarning(false);
            setIsRequestingOverride(false);

            const requiresPayment = !isWaitlist && !opts.requestApproval && (event.payment_type === "paid" || event.payment_type === "deposit");
            if (requiresPayment && result?.registrationId) {
              setPaymentLoading(true);
              try {
                const body: any = { eventId: event.id, registrationId: result.registrationId };
                if (opts.appliedDiscount?.discount_code_id) {
                  body.discountCodeId = opts.appliedDiscount.discount_code_id;
                }
                if (opts.priceOptionId) {
                  body.priceOptionId = opts.priceOptionId;
                }
                if (opts.paymentChoice) {
                  body.paymentChoice = opts.paymentChoice;
                }
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
                // Checkout failed — clean up the pending registration
                await supabase.from("event_registrations")
                  .update({ status: "cancelled" as any })
                  .eq("id", result.registrationId)
                  .eq("user_id", user!.id);
                toast({ title: "Errore pagamento", description: err.message, variant: "destructive" });
                setPaymentLoading(false);
              }
              return;
            }

            if (opts.requestApproval) {
              toast({ title: "Richiesta inviata", description: "La tua richiesta è stata inviata all'organizzatore.", duration: 5000 });
            } else if (isWaitlist) {
              toast({ title: "Lista d'attesa", description: `Sarai notificato quando si libererà un posto per ${event.title}` });
            } else {
              toast({ title: "Registrazione confermata", description: `Ti sei iscritto a ${event.title}` });
            }
          } catch (err: any) {
            toast({ title: "Errore", description: err.message, variant: "destructive" });
          }
        }}
        isSubmitting={registerMutation.isPending || membershipLoading || paymentLoading}
        isRequestingOverride={isRequestingOverride}
        requiresApproval={accessData?.requiresApproval}
        isSportCategory={isSportCategory}
      />

      {/* Access Warning Dialog */}
      <Dialog open={showAccessWarning} onOpenChange={setShowAccessWarning}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t("accessRequirements")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {accessData?.failedRules && accessData.failedRules.length > 0 && (
              <div className="p-4 rounded-xl bg-destructive/10 space-y-3 border border-destructive/30">
                <p className="text-sm font-body font-bold text-destructive flex items-center gap-1.5">
                  <Lock className="h-4 w-4" /> Non soddisfi i requisiti minimi per partecipare a questo evento.
                </p>
                <ul className="text-xs font-body text-foreground space-y-2 ml-1">
                  {accessData.failedRules.map((fr: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <span>{fr.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {accessData?.softWarnings && accessData.softWarnings.length > 0 && (
              <div className="p-4 rounded-xl bg-warning/10 space-y-3 border border-warning/30">
                <p className="text-sm font-body font-bold text-warning flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Questo evento potrebbe non essere perfettamente in linea con il tuo profilo.
                </p>
                <ul className="text-xs font-body text-foreground space-y-2 ml-1">
                  {accessData.softWarnings.map((sw: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                      <span>{sw.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {(!accessData?.failedRules || accessData.failedRules.length === 0) && (
                <Button
                  onClick={() => {
                    setShowAccessWarning(false);
                    setShowRegisterDialog(true);
                  }}
                  className="w-full font-body h-12"
                >
                  Procedi con la registrazione
                </Button>
              )}

              {organizerProfile?.phone && accessData?.failedRules && accessData.failedRules.length > 0 && (
                <Button
                  asChild
                  className="w-full font-body bg-[#25D366] text-white hover:bg-[#25D366]/90 border-none h-12"
                >
                  <a
                    href={`https://wa.me/${organizerProfile.phone.replace(/[^0-9+]/g, "")}?text=${encodeURIComponent(`Ciao! Sono interessato a partecipare a "${event.title}" ma la piattaforma indica che non soddisfo i requisiti. Potresti valutare la mia partecipazione?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {t("contactOrganizer")}
                  </a>
                </Button>
              )}

              {accessData?.failedRules && accessData.failedRules.length > 0 && (
                <Button
                  onClick={() => {
                    setShowAccessWarning(false);
                    setIsRequestingOverride(true);
                    setShowRegisterDialog(true);
                  }}
                  variant="outline"
                  className="w-full font-body h-12 border-warning/30 text-warning hover:bg-warning/5 hover:text-warning"
                >
                  {t("requestManualApprovalBtn")}
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full font-body text-muted-foreground text-xs h-10"
                onClick={() => setShowAccessWarning(false)}
              >
                {t("close")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fit Score Warning Dialog (score < 50) */}
      <Dialog open={showFitScoreWarning} onOpenChange={setShowFitScoreWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Sei sicuro sia l'evento giusto per te?
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <p className="font-body text-sm leading-relaxed text-muted-foreground">
              {fitScore.score < 30
                ? "Questo evento è probabilmente troppo impegnativo per te. Puoi comunque procedere, ma ti consigliamo di valutare bene prima di iscriverti."
                : "Questo evento è più impegnativo rispetto al tuo livello attuale. Richiede buona preparazione fisica ed esperienza."}
            </p>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              onClick={() => {
                setShowFitScoreWarning(false);
                setShowRegisterDialog(true);
              }}
              className="w-full font-body h-12"
            >
              👉 Partecipa comunque
            </Button>
            <Button
              variant="ghost"
              className="w-full font-body text-muted-foreground text-xs h-10"
              onClick={() => setShowFitScoreWarning(false)}
            >
              👉 Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DifficultyGuideDialog
        open={showDifficultyGuide}
        onOpenChange={setShowDifficultyGuide}
      />

      <ShareSheet
        open={showShareSheet}
        onOpenChange={setShowShareSheet}
        title={event?.title || ""}
        url={eventUrl}
        text={shareText}
      />

    </div>
  );
};

export default EventDetail;
