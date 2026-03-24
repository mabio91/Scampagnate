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
import { parseCancellationPolicy, CANCELLATION_POLICIES } from "@/lib/cancellationPolicy";
import { parseEventDateTime } from "@/lib/timezone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEvent, useEventParticipants, useMyRegistration, useRegisterForEvent, useCancelRegistration, useSavedEvents, useToggleSaveEvent } from "@/hooks/useEvents";
import { useCheckEventAccessRules, getExclusivityIndicators, type AccessRulesConfig } from "@/hooks/useEventAccessRules";
import { usePricingEligibility, getBestUserPrice, type PriceOption, type ResolvedPriceOption } from "@/hooks/usePricingEligibility";
import { BadgeIcon as BadgeIconComp } from "@/components/BadgeIcon";
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
import DiscountCodeInput from "@/components/events/DiscountCodeInput";
import { Checkbox } from "@/components/ui/checkbox";
import PhoneVerificationDialog from "@/components/PhoneVerificationDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import useEmblaCarousel from "embla-carousel-react";

const EventDetail = () => {
  const { id } = useParams();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { user, profile, isOrganizer, isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: event, isLoading } = useEvent(id!);
  const { data: participants } = useEventParticipants(id!);
  const { data: myRegistration } = useMyRegistration(id!);
  const { data: savedEvents } = useSavedEvents();
  const registerMutation = useRegisterForEvent();
  const cancelMutation = useCancelRegistration();
  const toggleSaveMutation = useToggleSaveEvent();

  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showDifficultyGuide, setShowDifficultyGuide] = useState(false);
  const [showAccessWarning, setShowAccessWarning] = useState(false);
  const [isRequestingOverride, setIsRequestingOverride] = useState(false);
  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState("");
  const [sportLevel, setSportLevel] = useState("");
  const [additionalResponses, setAdditionalResponses] = useState<Record<string, string>>({});
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [selectedPriceOption, setSelectedPriceOption] = useState("");
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [carAvailability, setCarAvailability] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // New states
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [showOrganizerContact, setShowOrganizerContact] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationLocation, setNavigationLocation] = useState("");
  const [showCalendarModal, setShowCalendarModal] = useState(false);

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

  const eventAccessRules = event?.access_rules as AccessRulesConfig | null;
  const { data: accessData, isLoading: accessLoading } = useCheckEventAccessRules(eventAccessRules, event?.difficulty || null);
  const exclusivityIndicators = getExclusivityIndicators(eventAccessRules);

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
  const isRegistered = myRegistration && myRegistration.status !== "cancelled";
  const isSportCategory = event.category?.name === "Sport & Movimento";
  const isSaved = savedEvents?.some((se: any) => se.event_id === event.id) || false;
  const eventStartDate = parseEventDateTime(event.date, event.time);
  const isEventPast = eventStartDate < new Date();

  const canViewParticipants = !!user && (!!isRegistered || user.id === event.organizer_id || isAdmin);

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
    if (isEventPast || event.status === "closed" || event.status === "cancelled" || event.status === "draft" || event.status === "past") return;

    if (needsPayment) {
      handleEventPayment();
      return;
    }

    if (isRegistered) return;

    if (!profile?.phone_verified) {
      setShowPhoneVerification(true);
      return;
    }

    if (accessData && !accessData.hasAccess) {
      setShowAccessWarning(true);
      return;
    }

    if (accessData && accessData.softWarnings && accessData.softWarnings.length > 0) {
      setShowAccessWarning(true);
      return;
    }

    setShowRegisterDialog(true);
  };

  const handlePhoneVerified = () => {
    setShowPhoneVerification(false);
    if (accessData && !accessData.hasAccess) {
      setShowAccessWarning(true);
    } else if (accessData && accessData.softWarnings && accessData.softWarnings.length > 0) {
      setShowAccessWarning(true);
    } else {
      setShowRegisterDialog(true);
    }
  };

  const handleMembershipCheckout = async () => {
    setMembershipLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-membership-checkout", {
        body: { eventId: event.id },
      });
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
      const { data, error } = await supabase.functions.invoke("create-event-checkout", {
        body,
      });
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

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(event.id);
      toast({ title: "Registrazione annullata", description: "La tua iscrizione è stata annullata." });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const needsPayment = isRegistered && myRegistration?.status !== "waitlist" && (event.payment_type === "paid" || event.payment_type === "deposit") && myRegistration?.payment_status !== "paid";
  const isPendingApproval = isRegistered && myRegistration?.status === "pending_approval";
  const isOnWaitlist = isRegistered && myRegistration?.status === "waitlist";

  // CTA PRIORITY ORDER (from highest to lowest)
  const getCTALabel = () => {
    if (isEventPast || event.status === "closed" || event.status === "cancelled" || event.status === "draft" || event.status === "past") return "Evento chiuso";
    if (!user) return "Partecipa";
    if (isRegistered && !needsPayment && !isOnWaitlist && !isPendingApproval) return "Registrato ✓";
    if (isPendingApproval) return "In attesa di approvazione";
    if (isOnWaitlist) return "Lista d'attesa";
    if (needsPayment) return "Paga ora";
    if (event.status === "full") return "Lista d'attesa";
    return "Partecipa";
  };

  const getCTAClass = () => {
    if (isEventPast || event.status === "closed" || event.status === "cancelled" || event.status === "draft" || event.status === "past") return "bg-muted text-muted-foreground cursor-not-allowed";
    if (!user) return "bg-primary text-primary-foreground hover:bg-primary/90";
    if (isRegistered && !needsPayment && !isOnWaitlist && !isPendingApproval) return "bg-green-600 text-white";
    if (isPendingApproval) return "bg-warning/20 text-warning border border-warning/30";
    if (isOnWaitlist) return "bg-warning/20 text-warning border border-warning/30";
    if (needsPayment) return "bg-accent text-accent-foreground hover:bg-accent/90";
    if (event.status === "full") return "bg-secondary text-secondary-foreground hover:bg-secondary/90";
    if (accessData && !accessData.hasAccess) return "bg-muted text-muted-foreground cursor-not-allowed opacity-70";
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
    const labels: Record<string, string> = {
      flexible: "Flessibile",
      moderate: "Moderata",
      strict: "Rigida",
      custom: "Personalizzata",
    };
    return labels[policyType] || null;
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

  const remainingSpots = event.spots_total - event.spots_taken;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background pb-28">
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

        {/* Badges over hero */}
        <div className="absolute bottom-12 left-4 right-4" style={{ opacity: heroOpacity }}>
          <div className="flex items-center gap-2 flex-wrap">
            {event.difficulty && (
              <button onClick={() => setShowDifficultyGuide(true)} className="flex items-center hover:opacity-90 transition-opacity">
                <DifficultyBadge difficulty={event.difficulty} className="bg-accent text-accent-foreground" />
              </button>
            )}
            {event.category && (
              <span className="inline-block px-2.5 py-1 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground text-xs font-body font-semibold">
                {event.category.name}
              </span>
            )}
            {exclusivityIndicators.map((ind, idx) => (
              <span key={idx} className={`inline-block px-2.5 py-1 rounded-full text-xs font-body font-semibold backdrop-blur-sm border border-white/10 shadow-sm ${
                ind.variant === "members" ? "bg-primary/90 text-primary-foreground" :
                ind.variant === "exclusive" ? "bg-gold/90 text-foreground" :
                ind.variant === "restricted" ? "bg-warning/90 text-warning-foreground" :
                "bg-secondary/90 text-secondary-foreground"
              }`}>
                {ind.variant === "members" ? "👑 " : ind.variant === "exclusive" ? "⭐ " : ind.variant === "restricted" ? "🔒 " : "✋ "}
                {ind.label}
              </span>
            ))}
            {(isOrganizer || isAdmin) && event.visibility !== "public" && (
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-body font-semibold ${
                event.visibility === 'private' ? 'bg-amber-100/90 text-amber-800' : 'bg-slate-800/80 text-white'
              } backdrop-blur-sm border border-white/10 shadow-sm`}>
                {event.visibility === 'private' ? '🔗 Private' : '👁️ Hidden'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rounded top container overlapping the hero */}
      <div className="relative -mt-6 bg-background rounded-t-3xl z-10">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">{event.title}</h1>
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
              <p className="text-sm font-body font-semibold text-foreground group-hover:text-secondary transition-colors">{event.location.split(',')[0]}</p>
              <p className="text-xs font-body text-muted-foreground truncate">{event.location}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
          </button>
        </motion.div>

        {/* 10. ORGANIZER + 9. PARTICIPANTS (WeMeet style) */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="py-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            {/* Organizer (left) */}
            <div className="flex-shrink-0">
              <p className="text-xs font-body font-semibold text-muted-foreground mb-2">{t("organizer")}</p>
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
                  <p className="text-xs font-body text-primary">Contatta</p>
                </div>
              </button>
            </div>

            {/* Participants (right) */}
            <div className="flex-shrink-0">
              <p className="text-xs font-body font-semibold text-muted-foreground mb-2">Chi c'è? ({event.spots_taken})</p>
              <button
                onClick={() => canViewParticipants && navigate(`/event/${event.id}/participants`)}
                className="flex items-center"
              >
                {canViewParticipants && participants && participants.length > 0 ? (
                  <div className="flex items-center">
                    <div className="flex -space-x-2.5">
                      {participants.slice(0, 3).map((p: any, idx: number) => (
                        <div key={p.id} className="relative" style={{ zIndex: 3 - idx }}>
                          {p.profiles?.avatar_url ? (
                            <img src={p.profiles.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-background" />
                          ) : (
                            <span className="w-9 h-9 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-semibold text-primary">
                              {p.profiles?.first_name?.[0] || "?"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {participants.length > 3 && (
                      <span className="w-9 h-9 -ml-2.5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-body font-bold text-muted-foreground z-0">
                        +{participants.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-body text-muted-foreground">
                    {event.spots_taken > 0 ? `${event.spots_taken} iscritti` : "Nessun iscritto"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        {event.distance && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-4 gap-2 py-4 border-b border-border">
            <div className="text-center">
              <Route className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.distance}</p>
              <p className="text-[10px] text-muted-foreground font-body">{t("distance")}</p>
            </div>
            <div className="text-center">
              <Mountain className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.elevation}</p>
              <p className="text-[10px] text-muted-foreground font-body">{t("elevation")}</p>
            </div>
            <div className="text-center">
              <Clock className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.duration}</p>
              <p className="text-[10px] text-muted-foreground font-body">{t("duration")}</p>
            </div>
            <div className="text-center">
              <Users className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.spots_taken}/{event.spots_total}</p>
              <p className="text-[10px] text-muted-foreground font-body">{t("spots")}</p>
            </div>
          </motion.div>
        )}

        {/* Weather Forecast */}
        <WeatherForecast location={event.location} date={event.date} />

        {/* 4. DESCRIPTION → "L'esperienza" with gradient fade */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="py-4 border-b border-border">
          <h3 className="font-display text-lg font-bold text-foreground mb-2">L'esperienza</h3>
          <div className="relative">
            <p className={`text-sm font-body text-muted-foreground leading-relaxed whitespace-pre-line ${!descriptionExpanded ? "line-clamp-6" : ""}`}>
              {event.description}
            </p>
            {event.description && event.description.length > 250 && !descriptionExpanded && (
              <>
                <div className="absolute bottom-6 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                <button
                  onClick={() => setDescriptionExpanded(true)}
                  className="relative text-sm font-body font-semibold text-primary mt-1 hover:underline"
                >
                  Leggi di più
                </button>
              </>
            )}
            {descriptionExpanded && event.description && event.description.length > 250 && (
              <button
                onClick={() => setDescriptionExpanded(false)}
                className="text-sm font-body font-semibold text-primary mt-1 hover:underline"
              >
                Mostra meno
              </button>
            )}
          </div>
        </motion.div>

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
                      <div className="space-y-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
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

        {/* 8. MEETING POINTS – compact */}
        {event.meeting_points && event.meeting_points.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="py-4 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground mb-3">{t("meetingPoints")}</h3>
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
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-body font-bold text-foreground">{mp.time?.slice(0, 5)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* 11. PAYMENT SECTION (SIMPLIFIED) */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="py-4 border-b border-border">
          <h3 className="font-display text-lg font-bold text-foreground mb-3">Prezzo</h3>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-display font-bold text-foreground">{getPriceDisplay()}</p>
            {getCancellationLabel() && (
              <span className="text-xs font-body text-muted-foreground px-2 py-1 rounded-full bg-muted">
                {getCancellationLabel()}
              </span>
            )}
          </div>
          {/* Optional included items */}
          {getIncludedItems().length > 0 && (
            <ul className="mt-2 space-y-1">
              {getIncludedItems().map((item: string, idx: number) => (
                <li key={idx} className="text-xs font-body text-muted-foreground flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {event.payment_type === "location" && Number(event.price) > 0 && (
            <p className="text-xs font-body text-muted-foreground mt-1">Da saldare in loco</p>
          )}
        </motion.div>

        {/* Actions for registered users */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="py-4">
          {/* Discount code for Pay Now state */}
          {needsPayment && user && (
            <div className="mb-4">
              <DiscountCodeInput
                eventId={event.id}
                userId={user.id}
                onDiscountApplied={setAppliedDiscount}
              />
            </div>
          )}

          {isRegistered && (
            <Button variant="outline" onClick={handleCancel} disabled={cancelMutation.isPending} className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20">
              {cancelMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Annullamento...</> : "Annulla iscrizione"}
            </Button>
          )}
        </motion.div>
      </div>
      </div> {/* end rounded top container */}

      {/* 12. STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border p-3 pb-safe z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
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
              <span className="text-xs font-body text-muted-foreground">·</span>
              <span className="text-xs font-body text-muted-foreground">{remainingSpots > 0 ? `${remainingSpots} posti disponibili` : "Sold out"}</span>
            </div>
            {/* Registration deadline (if applicable) */}
            {event.additional_fields && (event.additional_fields as any).registration_deadline && (
              <p className="text-[10px] font-body text-muted-foreground">
                Iscrizioni fino al {new Date((event.additional_fields as any).registration_deadline).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
            )}
          </div>
          <Button
            onClick={handleCTA}
            className={`px-6 py-3 rounded-xl font-body font-semibold text-sm shrink-0 ${getCTAClass()}`}
            disabled={
              paymentLoading ||
              isEventPast ||
              event.status === "closed" || event.status === "cancelled" || event.status === "draft" || event.status === "past" ||
              (!!user && isRegistered && !needsPayment && !isOnWaitlist && !isPendingApproval)
            }
          >
            {paymentLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Attendere...</>
            ) : getCTALabel()}
          </Button>
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
            <div className="flex items-center justify-between p-4 pt-safe">
              <span className="text-white/70 text-sm font-body">{galleryStartIndex + 1} / {event.gallery_images.length}</span>
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
                  asChild
                  className="w-full justify-start font-body bg-[#25D366] text-white hover:bg-[#25D366]/90 border-none"
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

      {/* Registration Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t("registerFor", { title: event.title })}</DialogTitle>
            <DialogDescription className="font-body text-sm">
              {t("completeRegistration")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Meeting Point */}
            {event.meeting_points && event.meeting_points.length > 0 && (
              <div>
                <Label className="font-body text-sm font-semibold">{t("meetingPoint")}</Label>
                <RadioGroup value={selectedMeetingPoint} onValueChange={setSelectedMeetingPoint} className="mt-2 space-y-2">
                  {event.meeting_points.map((mp: any) => (
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

            {/* Sport Level */}
            {isSportCategory && (
              <div>
                <Label className="font-body text-sm font-semibold">{t("sportLevel")}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[{ key: "Beginner", label: t("beginner") }, { key: "Intermediate", label: t("intermediate") }, { key: "Advanced", label: t("advanced") }].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSportLevel(sportLevel === key ? "" : key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-body font-semibold transition-colors ${sportLevel === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Input
                  value={!["Beginner", "Intermediate", "Advanced"].includes(sportLevel) ? sportLevel : ""}
                  onChange={(e) => setSportLevel(e.target.value)}
                  placeholder={t("orEnterCustomLevel")}
                  className="mt-2"
                />
              </div>
            )}

            {/* Car Availability */}
            {event.additional_fields && (event.additional_fields as any).car_availability_enabled && (
              <div>
                <Label className="font-body text-sm font-semibold">Saresti disposto a prendere la macchina?</Label>
                <RadioGroup value={carAvailability} onValueChange={setCarAvailability} className="mt-2 space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="yes" />
                    <span className="text-sm font-body">✅ Sì</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="prefer_not" />
                    <span className="text-sm font-body">🤷 Preferirei di no</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="no_car" />
                    <span className="text-sm font-body">🚶 Non sono automunito</span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {/* Additional Fields */}
            {(() => {
              const af = event.additional_fields as any;
              const fields = af && af.fields ? af.fields : (Array.isArray(af) ? af : []);
              if (!fields || fields.length === 0) return null;
              return fields.map((field: any, idx: number) => (
                <div key={idx}>
                  <Label className="font-body text-sm font-semibold">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {field.type === "text" && (
                    <Input
                      value={additionalResponses[field.label] || ""}
                      onChange={(e) => setAdditionalResponses(prev => ({ ...prev, [field.label]: e.target.value }))}
                      placeholder={field.placeholder || ""}
                      className="mt-1"
                    />
                  )}
                  {field.type === "select" && (
                    <Select
                      value={additionalResponses[field.label] || ""}
                      onValueChange={(val) => setAdditionalResponses(prev => ({ ...prev, [field.label]: val }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleziona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map((opt: string, optIdx: number) => (
                          <SelectItem key={optIdx} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.type === "number" && (
                    <Input
                      type="number"
                      value={additionalResponses[field.label] || ""}
                      onChange={(e) => setAdditionalResponses(prev => ({ ...prev, [field.label]: e.target.value }))}
                      placeholder={field.placeholder || ""}
                      className="mt-1"
                    />
                  )}
                </div>
              ));
            })()}

            {/* Mandatory Equipment Confirmation */}
            {event.equipment_list && Array.isArray(event.equipment_list) && (event.equipment_list as any[]).some((item: any) => item.is_mandatory) && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={equipmentConfirmed}
                    onCheckedChange={(checked) => setEquipmentConfirmed(!!checked)}
                    className="mt-0.5"
                  />
                  <span className="text-xs font-body text-foreground leading-relaxed">
                    Confermo di avere tutta l'attrezzatura obbligatoria richiesta per questa attività
                  </span>
                </label>
              </div>
            )}

            {/* ── Pricing Options ── */}
            {resolvedPriceOptions && resolvedPriceOptions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <Label className="font-body text-sm font-semibold">{t("choosePricingOption")}</Label>
                </div>
                <RadioGroup value={selectedPriceOption} onValueChange={setSelectedPriceOption} className="space-y-2">
                  {resolvedPriceOptions.map((opt: ResolvedPriceOption) => (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        !opt.isEligible ? "bg-muted/30 opacity-60 cursor-not-allowed" :
                        selectedPriceOption === opt.id ? "bg-primary/10 border-2 border-primary" :
                        "bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={opt.id} disabled={!opt.isEligible} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-body font-semibold text-foreground">{opt.name}</span>
                            {opt.isEligible && opt.eligible_group !== "all" && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-body font-semibold flex items-center gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" /> {opt.eligible_group === "members" ? "Soci" : opt.eligible_group === "experienced" ? "Esperto" : opt.eligible_group === "loyal" ? "Fedele" : opt.eligible_group}
                              </span>
                            )}
                            {opt.is_promotional && opt.isPromoActive && (
                              <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-body font-semibold flex items-center gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" /> Promo
                              </span>
                            )}
                          </div>
                          {!opt.isEligible && opt.eligibilityReason && (
                            <p className="text-[10px] text-muted-foreground font-body flex items-center gap-1 mt-0.5">
                              <Lock className="h-2.5 w-2.5" /> {opt.eligibilityReason}
                            </p>
                          )}
                          {opt.is_promotional && !opt.isPromoActive && (
                            <p className="text-[10px] text-muted-foreground font-body mt-0.5">{t("promoExpired")}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {opt.original_price && opt.original_price > opt.price && (
                          <span className="text-xs font-body text-muted-foreground line-through block">€{opt.original_price.toFixed(2)}</span>
                        )}
                        <span className={`text-sm font-display font-bold ${opt.isEligible && opt.original_price ? "text-green-500" : "text-foreground"}`}>
                          €{Number(opt.price).toFixed(2)}
                        </span>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}
            {/* Fallback price options */}
            {!resolvedPriceOptions && event.price_options && event.price_options.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <Label className="font-body text-sm font-semibold">{t("choosePricingOption")}</Label>
                </div>
                <RadioGroup value={selectedPriceOption} onValueChange={setSelectedPriceOption} className="space-y-2">
                  {event.price_options.map((opt: any) => (
                    <label key={opt.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={opt.id} />
                        <span className="text-sm font-body font-semibold text-foreground">{opt.name}</span>
                      </div>
                      <span className="text-sm font-display font-bold text-foreground">€{Number(opt.price).toFixed(2)}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Discount Code */}
            {event.payment_type !== "free" && event.payment_type !== "location" && user && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <Label className="font-body text-sm font-semibold">{t("discountCode")} <span className="text-muted-foreground font-normal">({t("optional")})</span></Label>
                </div>
                <DiscountCodeInput
                  eventId={event.id}
                  userId={user.id}
                  onDiscountApplied={setAppliedDiscount}
                />
              </div>
            )}

            {/* Membership Verification */}
            {!isMembershipActive(profile) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <Label className="font-body text-sm font-semibold">
                    {isMembershipExpired(profile) ? t("membershipRenewalRequired") : t("membershipRequired")}
                  </Label>
                </div>
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <p className="text-xs font-body font-bold text-primary">{t("membershipCardTitle")}</p>
                  </div>
                  <div className="text-[10px] font-body text-primary/90 leading-relaxed space-y-2">
                    {isMembershipExpired(profile) ? (
                      <>
                        <p>{t("membershipExpiredText")}</p>
                        <p>{t("membershipKeepId")} <strong>#{profile?.membership_id}</strong></p>
                      </>
                    ) : (
                      <>
                        <p>{t("membershipNewText")}</p>
                        <p>{t("membershipAfterPayment")}</p>
                      </>
                    )}
                    <p>{t("membershipFeePerYear", { year: String(new Date().getFullYear()) })}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Order Summary */}
            {event.payment_type !== "free" && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">{!isMembershipActive(profile) ? '4' : '3'}</span>
                  <Label className="font-body text-sm font-semibold">{t("orderSummary")}</Label>
                </div>
                <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 space-y-1.5">
                  {(() => {
                    const selectedOpt = event.price_options?.find((o: any) => o.id === selectedPriceOption);
                    const basePrice = selectedOpt ? Number(selectedOpt.price) : Number(event.price);
                    const displayLabel = selectedOpt ? selectedOpt.name : t("event");
                    const isDeposit = (event.payment_type as string) === "deposit" && event.deposit && !selectedOpt;
                    const depositAmount = isDeposit ? Number(event.deposit) : 0;
                    const displayPrice = isDeposit ? depositAmount : basePrice;
                    const needsMembership = !isMembershipActive(profile);
                    const membershipFee = needsMembership ? 10 : 0;
                    const discountedEventPrice = appliedDiscount ? Number(appliedDiscount.final_price) : displayPrice;

                    return (
                      <>
                        <div className="flex justify-between text-sm font-body">
                          <span className="text-muted-foreground">{isDeposit ? `${t("deposit")} — ${displayLabel}` : displayLabel}</span>
                          <span className={`font-semibold ${appliedDiscount ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            €{displayPrice.toFixed(2)}
                          </span>
                        </div>
                        {appliedDiscount && (
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-success font-semibold flex items-center gap-1">
                              <Tag className="h-3 w-3" /> {t("discountApplied")}
                            </span>
                            <span className="font-bold text-success">€{discountedEventPrice.toFixed(2)}</span>
                          </div>
                        )}
                        {isDeposit && (
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-muted-foreground">{t("remainingPayLater")}</span>
                            <span className="text-muted-foreground">€{(Number(event.price) - depositAmount).toFixed(2)}</span>
                          </div>
                        )}
                        {(event.payment_type as string) === "location" && (
                          <p className="text-xs font-body text-muted-foreground">{t("paymentOnLocation")}</p>
                        )}
                        {needsMembership && (
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-primary font-semibold flex items-center gap-1">
                              <CreditCard className="h-3 w-3" /> {t("membershipFee")}
                            </span>
                            <span className="font-semibold text-primary">€{membershipFee.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-body pt-1.5 mt-1 border-t border-gold/20">
                          <span className="font-bold text-foreground">{t("totalDueToday")}</span>
                          <span className="font-bold text-foreground text-base">
                            €{(discountedEventPrice + membershipFee).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[10px] font-body text-muted-foreground pt-1">
                          {needsMembership
                            ? t("membershipIncludedInCheckout")
                            : (event.payment_type === "paid" || selectedOpt)
                              ? t("fullPaymentViaStripe")
                              : isDeposit
                                ? t("depositViaStripe")
                                : ""
                          }
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            <Button
              onClick={() => handleRegister(isRequestingOverride || (accessData?.requiresApproval ?? false))}
              disabled={
                registerMutation.isPending || membershipLoading || paymentLoading ||
                (event.meeting_points && event.meeting_points.length > 0 && !selectedMeetingPoint) ||
                (event.price_options && event.price_options.length > 0 && !selectedPriceOption) ||
                (() => { const af = event.additional_fields as any; const fields = af && af.fields ? af.fields : (Array.isArray(af) ? af : []); return fields.some((f: any) => f.required && !additionalResponses[f.label]?.trim()); })() ||
                (event.equipment_list && Array.isArray(event.equipment_list) && (event.equipment_list as any[]).some((item: any) => item.is_mandatory) && !equipmentConfirmed)
              }
              className={`w-full font-body font-semibold ${event.status === "full" ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
            >
              {(registerMutation.isPending || membershipLoading || paymentLoading) ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{paymentLoading ? t("redirectingToPayment") : membershipLoading ? t("redirectingToPayment") : (isRequestingOverride || accessData?.requiresApproval) ? t("submitting") : t("registering")}</>
              ) : !isMembershipActive(profile) ? (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {isMembershipExpired(profile) ? t("renewMembershipAndRegister") : t("payMembershipAndRegister")}
                </>
              ) : (event.payment_type === "paid" || event.payment_type === "deposit") ? (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {t("payNow")}
                </>
              ) : event.status === "full" ? (
                t("joinWaitlist")
              ) : (isRequestingOverride || accessData?.requiresApproval) ? (
                t("submitRequest")
              ) : (
                t("confirmRegistration")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      <PhoneVerificationDialog
        open={showPhoneVerification}
        onOpenChange={setShowPhoneVerification}
        onVerified={handlePhoneVerified}
      />
    </div>
  );
};

export default EventDetail;
