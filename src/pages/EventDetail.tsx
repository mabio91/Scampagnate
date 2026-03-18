import { useState } from "react";
import { isMembershipActive, isMembershipExpired } from "@/lib/membership";
import { useLanguage } from "@/contexts/LanguageContext";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CalendarDays, MapPin, Users, Clock, Mountain,
  Route, Share2, Navigation, ChevronRight, Heart, Bookmark, BookmarkCheck, CalendarPlus,
  Calendar, Apple, Mail, Map, Car, MapPinned, MessageCircle, Phone, User as UserIcon, Loader2, CreditCard, Ticket, Lock, Tag, Sparkles, AlertCircle, ShieldAlert
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
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [selectedPriceOption, setSelectedPriceOption] = useState("");
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);

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
      // Get public profile data
      const { data: publicData } = await supabase.rpc("get_public_profile", { profile_id: event.organizer_id });
      const pub = publicData?.[0] || null;
      // Try to get phone (only works if user has RLS access — e.g. self, admin, or event participant)
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
    // On mobile, always download .ics file — it opens the native calendar app
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
    // On desktop, use web URLs for Google/Outlook, .ics for Apple
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

    if (accessData && !accessData.hasAccess) {
      setShowAccessWarning(true);
      return;
    }

    setShowRegisterDialog(true);
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
      // Pass price option if selected
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
    // For free/location events, non-members complete membership checkout first.
    // For paid/deposit events, membership is charged together in event checkout.
    if (!isMembershipActive(profile) && (event.payment_type === "free" || event.payment_type === "location")) {
      await handleMembershipCheckout();
      return;
    }

    const isWaitlist = event.status === "full";
    try {
      await registerMutation.mutateAsync({
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

      if (requestApproval) {
        toast({ title: "Request sent", description: "Your manual approval request has been sent to the organizer.", duration: 5000 });
      } else if (isWaitlist) {
        toast({ title: "Added to waitlist", description: `You'll be notified when a spot opens for ${event.title}` });
      } else {
        toast({ title: "Registration confirmed", description: `You've registered for ${event.title}` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(event.id);
      toast({ title: "Registration cancelled", description: "Your registration has been cancelled." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const needsPayment = isRegistered && myRegistration?.status !== "waitlist" && (event.payment_type === "paid" || event.payment_type === "deposit") && myRegistration?.payment_status !== "paid";
  const isPendingApproval = isRegistered && myRegistration?.status === "pending_approval";
  const isOnWaitlist = isRegistered && myRegistration?.status === "waitlist";

  const getCTALabel = () => {
    if (isEventPast || event.status === "closed" || event.status === "cancelled" || event.status === "draft" || event.status === "past") return t("eventClosed");
    if (!user) return t("signInToJoin");
    if (isPendingApproval) return t("approvalPending");
    if (isOnWaitlist) return t("onWaitlist");
    if (needsPayment) return t("payNow");
    if (isRegistered) return t("registered");
    if (event.status === "full") return t("joinWaitlist");
    if (accessData && !accessData.hasAccess) return t("viewRequirements");
    return t("joinEvent");
  };

  const getCTAClass = () => {
    if (isEventPast || event.status === "closed" || event.status === "cancelled" || event.status === "draft" || event.status === "past") return "bg-muted text-muted-foreground cursor-not-allowed";
    if (!user) return "bg-primary text-primary-foreground hover:bg-primary/90";
    if (isOnWaitlist || isPendingApproval) return "bg-warning/20 text-warning border border-warning/30";
    if (needsPayment) return "bg-accent text-accent-foreground hover:bg-accent/90";
    if (isRegistered) return "bg-success text-success-foreground";
    if (event.status === "full") return "bg-secondary text-secondary-foreground hover:bg-secondary/90";
    if (accessData && !accessData.hasAccess) return "bg-muted text-muted-foreground cursor-not-allowed opacity-70";
    return "bg-primary text-primary-foreground hover:bg-primary/90";
  };

  const shareEvent = () => setShowShareSheet(true);

  const eventUrl = `${window.location.origin}/event/${event.id}`;
  const shareText = `${event.title} - ${new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}`;

  const openDirections = (location: string, app: "google" | "apple" | "waze") => {
    const encoded = encodeURIComponent(location);
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
      apple: `https://maps.apple.com/?daddr=${encoded}`,
      waze: `https://waze.com/ul?q=${encoded}&navigate=yes`,
    };
    window.open(urls[app], "_blank");
  };

  const DirectionsButton = ({ location, className = "" }: { location: string; className?: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-xs sm:text-sm font-body font-semibold hover:bg-secondary/20 transition-colors ${className}`}>
          <Navigation className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("directions")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => openDirections(location, "google")} className="font-body cursor-pointer">
          <MapPinned className="h-4 w-4 mr-2 text-muted-foreground" /> Google Maps
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDirections(location, "apple")} className="font-body cursor-pointer">
          <Map className="h-4 w-4 mr-2 text-muted-foreground" /> Apple Maps
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDirections(location, "waze")} className="font-body cursor-pointer">
          <Car className="h-4 w-4 mr-2 text-muted-foreground" /> Waze
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background pb-28">
      {/* Hero */}
      <div className="relative">
        <OptimizedImage src={event.image_url} alt={event.title} className="w-full h-72 object-cover bg-muted" width={600} height={288} loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
        <Link to="/" className="absolute top-4 left-4 p-2 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={handleToggleSave} className="p-2 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground">
            {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          </button>
          <button onClick={shareEvent} className="p-2 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 mb-2">
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
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary-foreground leading-tight">{event.title}</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {/* Quick Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-4 border-b border-border">
          <div className="flex flex-wrap gap-4 mb-3">
            <div className="flex items-center gap-2 text-sm font-body text-foreground">
              <CalendarDays className="h-4 w-4 text-secondary" />
              {new Date(event.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
              <span className="text-muted-foreground">· {event.time?.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-body text-foreground">
              <MapPin className="h-4 w-4 text-secondary" />
              {event.location}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DirectionsButton location={event.location} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-xs sm:text-sm font-body font-semibold hover:bg-secondary/20 transition-colors">
                  <CalendarPlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t("addToCalendar")}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => handleAddToCalendar("google")} className="font-body cursor-pointer">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> Google Calendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddToCalendar("apple")} className="font-body cursor-pointer">
                  <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> Apple Calendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddToCalendar("outlook")} className="font-body cursor-pointer">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" /> Outlook Calendar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        {/* Description */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="py-4 border-b border-border">
          <h3 className="font-display text-lg font-bold text-foreground mb-2">{t("description")}</h3>
          <p className="text-sm font-body text-muted-foreground leading-relaxed">{event.description}</p>
        </motion.div>

        {/* Gallery */}
        {event.gallery_images && event.gallery_images.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="py-4 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground mb-3">{t("gallery")}</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 auto-cols-[180px] grid-flow-col grid">
              {event.gallery_images.sort((a,b) => a.order - b.order).map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-muted group cursor-pointer shadow-md active:scale-95 transition-all">
                  <OptimizedImage 
                    src={img.url} 
                    alt={`Gallery ${idx + 1}`} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    width={180} 
                    height={180}
                  />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Equipment List */}
        {event.equipment_list && Array.isArray(event.equipment_list) && (event.equipment_list as any[]).length > 0 && (() => {
          const allItems = event.equipment_list as any[];
          const mandatoryItems = allItems.filter((item: any) => item.is_mandatory);
          const recommendedItems = allItems.filter((item: any) => !item.is_mandatory);
          const hasMandatory = mandatoryItems.length > 0;

          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="py-4 border-b border-border">
              <h3 className="font-display text-lg font-bold text-foreground mb-3">{t("equipment")}</h3>

              {/* Mandatory Equipment */}
              {hasMandatory && (
                <div className="mb-4">
                  <p className="text-xs font-body font-bold text-destructive uppercase tracking-wider mb-2">Mandatory Equipment</p>
                  <div className="space-y-2 p-3 rounded-xl bg-destructive/5 border border-destructive/15">
                    {mandatoryItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm font-body">
                        <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-[10px] font-bold">!</span>
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
                  <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-2">Recommended Equipment</p>
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

              {/* Safety Warning */}
              {hasMandatory && (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs font-body text-warning-foreground leading-relaxed">
                    <strong>Safety notice:</strong> Participants who arrive without the required mandatory equipment may not be allowed to join the activity for safety reasons.
                  </p>
                </div>
              )}
            </motion.div>
          );
        })()}


        {event.meeting_points && event.meeting_points.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="py-4 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground mb-3">Meeting Points</h3>
            <div className="space-y-3">
              {event.meeting_points.map((mp) => (
                <div key={mp.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-body font-semibold text-foreground truncate">{mp.name}</p>
                      <p className="text-xs font-body text-muted-foreground truncate">{mp.location} · {mp.time?.slice(0, 5)}</p>
                    </div>
                  </div>
                  <DirectionsButton location={mp.location} />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Participants */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold text-foreground">Participants</h3>
            <span className="text-sm font-body font-semibold text-secondary">{event.spots_taken} Joined</span>
          </div>

          {/* Avatar circles row - only for logged-in users */}
          {canViewParticipants && participants && participants.length > 0 && (
            <div className="flex items-center mb-3">
              <div className="flex -space-x-3">
                {participants.slice(0, 4).map((p: any, idx: number) => (
                  <div key={p.id} className="relative" style={{ zIndex: 4 - idx }}>
                    {p.profiles?.avatar_url ? (
                      <img src={p.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-background" />
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-sm font-semibold text-primary">
                        {p.profiles?.first_name?.[0] || "?"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {participants.length > 4 && (
                <button
                  onClick={() => setShowAllParticipants(true)}
                  className="w-10 h-10 -ml-3 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-body font-semibold text-muted-foreground hover:bg-muted/80 transition-colors z-0"
                >
                  +{participants.length - 4}
                </button>
              )}
            </div>
          )}

          {/* Capacity bar */}
          <div className="w-full h-2 rounded-full bg-muted mb-3">
            <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${Math.min(100, (event.spots_taken / event.spots_total) * 100)}%` }} />
          </div>
          {event.status !== "full" && (
            <CapacityWarning spotsTaken={event.spots_taken} spotsTotal={event.spots_total} variant="large" className="mb-2" />
          )}

          {/* Guest view */}
          {!canViewParticipants && (
            <p className="text-sm font-body text-muted-foreground">
              {event.spots_taken > 0
                ? `${event.spots_taken} participant${event.spots_taken > 1 ? "s" : ""} already joined. ${!user ? 'Sign in and join' : 'Join'} to see who's going.`
                : `No participants yet. ${!user ? 'Sign in and be' : 'Be'} the first to join.`}
            </p>
          )}

          {/* Category / organizer badges under circles */}
          {canViewParticipants && participants && participants.length > 0 && (
            <>
              {/* Organizer-only: meeting point assignments */}
              {(user?.id === event.organizer_id) && event.meeting_points && event.meeting_points.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-body font-semibold text-muted-foreground mb-2">Meeting point assignments:</p>
                  <div className="space-y-1">
                    {participants.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs font-body px-2 py-1.5 rounded-lg bg-muted/30">
                        <span className="text-foreground font-medium">{p.profiles?.first_name}</span>
                        <span className="text-muted-foreground">{p.meeting_point?.name || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {canViewParticipants && (!participants || participants.length === 0) && (
            <p className="text-sm font-body text-muted-foreground">No participants yet</p>
          )}
        </motion.div>

        {/* Expanded Participants Dialog */}
        <Dialog open={showAllParticipants} onOpenChange={setShowAllParticipants}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Participants ({participants?.length || 0})</DialogTitle>
              <DialogDescription className="font-body text-sm">Everyone joining this event</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {participants?.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                  {p.profiles?.avatar_url ? (
                    <img src={p.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                      {p.profiles?.first_name?.[0] || "?"}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-semibold text-foreground truncate">
                      {p.profiles?.first_name}{p.profiles?.last_name_initial ? ` ${p.profiles.last_name_initial}` : ''}
                    </p>
                    {p.badges && p.badges.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {p.badges.slice(0, 3).map((b: any, i: number) => (
                          <span key={i} className="inline-flex items-center gap-0.5 text-[10px] font-body text-muted-foreground">
                            <BadgeIconComp icon={b.icon} className="h-3 w-3 text-primary" />
                            {b.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Organizer & Contact */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="py-4 border-b border-border">
          <h3 className="font-display text-lg font-bold text-foreground mb-3">Organizer</h3>
          <Link to={`/organizer/${event.organizer_id}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors group">
            {organizerProfile?.avatar_url ? (
              <img src={organizerProfile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover group-hover:ring-2 group-hover:ring-primary transition-all" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-body font-bold group-hover:bg-primary group-hover:text-white transition-all">
                {event.organizer_name?.[0] || "O"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body font-semibold text-foreground group-hover:text-primary transition-colors">{event.organizer_name}</p>
              <p className="text-xs font-body text-muted-foreground">View Profile <ChevronRight className="inline-block h-3 w-3" /></p>
            </div>
          </Link>

          {/* Contact options */}
          {user && (
            <div className="flex gap-2 mt-3">
              {organizerProfile?.phone && (
                <>
                  <a
                    href={`https://wa.me/${organizerProfile.phone.replace(/[^0-9+]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 flex-1 justify-center px-3 py-2.5 rounded-xl bg-[#25D366]/10 text-[#25D366] text-sm font-body font-semibold hover:bg-[#25D366]/20 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                  <a
                    href={`tel:${organizerProfile.phone}`}
                    className="flex items-center gap-2 flex-1 justify-center px-3 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-body font-semibold hover:bg-primary/20 transition-colors"
                  >
                    <Phone className="h-4 w-4" /> Call
                  </a>
                </>
              )}
              {!organizerProfile?.phone && (
                <p className="text-xs font-body text-muted-foreground">Contact info not available</p>
              )}
            </div>
          )}
          {!user && (
            <p className="text-xs font-body text-muted-foreground mt-2">Sign in to contact the organizer</p>
          )}
        </motion.div>

        {/* Payment & Pricing Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="py-4">
          {event.payment_type !== "free" && (
            <div className="p-4 rounded-xl bg-gold/10 border border-gold/20 mb-4 space-y-2">
              <p className="text-sm font-body font-bold text-foreground">
                {(event.payment_type as string) === "paid" && "Full Payment Online"}
                {(event.payment_type as string) === "location" && "Payment on Location"}
                {(event.payment_type as string) === "deposit" && "Split Payment"}
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted-foreground">Total price</span>
                  <span className="font-semibold text-foreground">€{Number(event.price).toFixed(2)}</span>
                </div>
                {event.payment_type === "deposit" && event.deposit && (
                  <>
                    <div className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Deposit (online via Stripe)</span>
                      <span className="font-semibold text-foreground">€{Number(event.deposit).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-body pt-1 border-t border-gold/20">
                      <span className="text-muted-foreground">Remaining balance</span>
                      <span className="font-semibold text-foreground">€{(Number(event.price) - Number(event.deposit)).toFixed(2)}</span>
                    </div>
                    <p className="text-xs font-body text-muted-foreground mt-1">
                      Remaining balance can be paid before the event or on location.
                    </p>
                  </>
                )}
                {(event.payment_type as string) === "paid" && (
                  <p className="text-xs font-body text-muted-foreground">
                    Full amount will be charged online via Stripe during registration.
                  </p>
                )}
                {(event.payment_type as string) === "location" && (
                  <p className="text-xs font-body text-muted-foreground">
                    Payment will be collected on location at the event.
                  </p>
                )}
              </div>
            </div>
          )}
          {event.cancellation_policy && (() => {
            const { policyType, customText } = parseCancellationPolicy(event.cancellation_policy);
            if (!policyType) return null;
            const policy = CANCELLATION_POLICIES[policyType];
            const PolicyIcon = policy.icon;
            return (
              <div className={`p-4 rounded-xl mb-4 border ${policy.bgClass} ${policy.borderClass}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <PolicyIcon className={`h-4 w-4 ${policy.colorClass}`} />
                  <p className={`text-sm font-body font-bold ${policy.colorClass}`}>{policy.label} Cancellation Policy</p>
                </div>
                <p className="text-xs font-body text-muted-foreground leading-relaxed">
                  {policyType === "custom" ? customText : policy.description}
                </p>
                {event.payment_type === "deposit" && (
                  <p className="text-[11px] font-body text-muted-foreground mt-1.5 italic border-t border-current/10 pt-1.5">
                    Deposit refund is subject to this policy.
                  </p>
                )}
              </div>
            );
          })()}

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
              {cancelMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelling...</> : "Cancel Registration"}
            </Button>
          )}
        </motion.div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border p-4 pb-safe z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-body text-muted-foreground">
              {resolvedPriceOptions && resolvedPriceOptions.length > 0
                ? (bestPrice.label ? "Your price" : "From")
                : (event.payment_type as string) === "deposit" ? "From" : "Price"}
            </p>
            {appliedDiscount && needsPayment ? (
              <div className="flex items-center gap-2">
                <p className="text-sm font-display font-bold text-muted-foreground line-through">
                  €{Number(appliedDiscount.original_price).toFixed(2)}
                </p>
                <p className="text-xl font-display font-bold text-success">
                  €{Number(appliedDiscount.final_price).toFixed(2)}
                </p>
              </div>
            ) : (
              <div>
                {bestPrice.originalPrice && bestPrice.originalPrice > bestPrice.price && (
                  <p className="text-xs font-display text-muted-foreground line-through">€{bestPrice.originalPrice.toFixed(2)}</p>
                )}
                <p className={`text-xl font-display font-bold ${bestPrice.originalPrice && bestPrice.originalPrice > bestPrice.price ? "text-green-500" : "text-foreground"}`}>
                  {(() => {
                    if (resolvedPriceOptions && resolvedPriceOptions.length > 0) {
                      const eligible = resolvedPriceOptions.filter(o => o.isEligible && o.isPromoActive);
                      if (eligible.length > 0) return `€${Math.min(...eligible.map(o => o.price)).toFixed(2)}`;
                      const allGroup = resolvedPriceOptions.filter(o => o.eligible_group === "all" && o.isPromoActive);
                      if (allGroup.length > 0) return `€${Math.min(...allGroup.map(o => o.price)).toFixed(2)}`;
                    }
                    const hasPriceOptions = event.price_options && event.price_options.length > 0;
                    if (hasPriceOptions) {
                      const minPrice = Math.min(...event.price_options!.map((o: any) => Number(o.price)));
                      return `€${minPrice.toFixed(2)}`;
                    }
                    if (Number(event.price) === 0 && (!profile || isMembershipActive(profile))) return "Free";
                    if ((event.payment_type as string) === "deposit" && event.deposit) return `€${event.deposit}`;
                    return `€${Number(event.price)}`;
                  })()}
                </p>
              </div>
            )}
            {(event.payment_type as string) === "deposit" && event.deposit && !appliedDiscount && (
              <p className="text-[10px] font-body text-muted-foreground">deposit · €{Number(event.price)} total</p>
            )}
            {(event.payment_type as string) === "location" && Number(event.price) > 0 && (
              <p className="text-[10px] font-body text-muted-foreground">pay on location</p>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={handleCTA}
              className={`px-8 py-3 rounded-xl font-body font-semibold text-base w-full sm:w-auto ${getCTAClass()}`}
              disabled={paymentLoading || isEventPast || event.status === "closed" || event.status === "cancelled" || event.status === "draft" || event.status === "past" || (!!user && isRegistered && !needsPayment && !isOnWaitlist)}
            >
              {paymentLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting...</>
              ) : getCTALabel()}
            </Button>
            {accessData && !accessData.hasAccess && !isRegistered && !isEventPast && event.status !== "closed" && event.status !== "cancelled" && (
              <button
                onClick={() => setShowAccessWarning(true)}
                className="text-[10px] font-body text-primary hover:underline"
              >
                Request manual approval
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Registration Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Register for {event.title}</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Complete your registration by selecting the required options.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Auxiliary: Meeting Point */}
            {event.meeting_points && event.meeting_points.length > 0 && (
              <div>
                <Label className="font-body text-sm font-semibold">Meeting Point</Label>
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

            {/* Auxiliary: Sport Level */}
            {isSportCategory && (
              <div>
                <Label className="font-body text-sm font-semibold">Sport Level</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Beginner", "Intermediate", "Advanced"].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSportLevel(sportLevel === level ? "" : level)}
                      className={`px-3 py-1.5 rounded-full text-xs font-body font-semibold transition-colors ${sportLevel === level
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <Input
                  value={!["Beginner", "Intermediate", "Advanced"].includes(sportLevel) ? sportLevel : ""}
                  onChange={(e) => setSportLevel(e.target.value)}
                  placeholder="Or enter custom level (e.g. 3.5 for padel)"
                  className="mt-2"
                />
                <p className="text-[10px] text-muted-foreground font-body mt-1">
                  Helps organizers balance teams and plan activities
                </p>
              </div>
            )}

            {/* Additional Registration Fields */}
            {event.additional_fields && Array.isArray(event.additional_fields) && (event.additional_fields as any[]).length > 0 && (
              <div className="space-y-3">
                {(event.additional_fields as any[]).map((field: any, idx: number) => (
                  <div key={idx}>
                    <Label className="font-body text-sm font-semibold">
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </Label>
                    {field.type === "select" && field.options ? (
                      <Select
                        value={additionalResponses[field.label] || ""}
                        onValueChange={(v) => setAdditionalResponses(prev => ({ ...prev, [field.label]: v }))}
                      >
                        <SelectTrigger className="mt-1"><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
                        <SelectContent>
                          {field.options.split(",").map((opt: string) => (
                            <SelectItem key={opt.trim()} value={opt.trim()}>{opt.trim()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={additionalResponses[field.label] || ""}
                        onChange={(e) => setAdditionalResponses(prev => ({ ...prev, [field.label]: e.target.value }))}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        className="mt-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Mandatory Equipment Confirmation */}
            {event.equipment_list && Array.isArray(event.equipment_list) && (event.equipment_list as any[]).some((item: any) => item.is_mandatory) && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/15 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs font-body font-bold text-destructive">Mandatory Equipment Required</p>
                  </div>
                  <div className="space-y-1 ml-6">
                    {(event.equipment_list as any[]).filter((item: any) => item.is_mandatory).map((item: any, idx: number) => (
                      <p key={idx} className="text-xs font-body text-foreground">• {item.name}</p>
                    ))}
                  </div>
                  <p className="text-[10px] font-body text-muted-foreground ml-6">
                    Participants who arrive without the required equipment may not be allowed to join the activity for safety reasons.
                  </p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <Checkbox
                    checked={equipmentConfirmed}
                    onCheckedChange={(v) => setEquipmentConfirmed(!!v)}
                    className="mt-0.5"
                  />
                  <span className="text-xs font-body text-foreground leading-relaxed group-hover:text-foreground/80 transition-colors">
                    I confirm that I have read the mandatory equipment requirements and will attend the event with the appropriate gear.
                  </span>
                </label>
              </div>
            )}

            {/* ── STEP 1: Select Pricing Option ── */}
            {resolvedPriceOptions && resolvedPriceOptions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <Label className="font-body text-sm font-semibold">Choose your pricing option</Label>
                </div>
                <RadioGroup value={selectedPriceOption} onValueChange={setSelectedPriceOption} className="space-y-2">
                  {resolvedPriceOptions.map((opt: ResolvedPriceOption) => (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        opt.isEligible && opt.isPromoActive
                          ? "bg-muted/50 hover:bg-muted"
                          : "bg-muted/20 opacity-60 cursor-not-allowed"
                      }`}
                      onClick={(e) => {
                        if (!opt.isEligible || !opt.isPromoActive) e.preventDefault();
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={opt.id} disabled={!opt.isEligible || !opt.isPromoActive} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-body font-semibold text-foreground">{opt.name}</span>
                            {opt.eligible_group === "members" && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-body font-semibold">Members</span>
                            )}
                            {opt.eligible_group === "experienced" && (
                              <span className="text-[10px] bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded-full font-body font-semibold">Experienced</span>
                            )}
                            {opt.eligible_group === "loyal" && (
                              <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-body font-semibold">Loyal</span>
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
                            <p className="text-[10px] text-muted-foreground font-body mt-0.5">Promozione scaduta</p>
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
            {/* Fallback: show raw price options if eligibility not loaded yet */}
            {!resolvedPriceOptions && event.price_options && event.price_options.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <Label className="font-body text-sm font-semibold">Choose your pricing option</Label>
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

            {/* ── STEP 2: Discount Code ── */}
            {event.payment_type !== "free" && event.payment_type !== "location" && user && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <Label className="font-body text-sm font-semibold">Discount Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
                </div>
                <DiscountCodeInput
                  eventId={event.id}
                  userId={user.id}
                  onDiscountApplied={setAppliedDiscount}
                />
              </div>
            )}

            {/* ── STEP 3: Membership Verification ── */}
            {!isMembershipActive(profile) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <Label className="font-body text-sm font-semibold">
                    {isMembershipExpired(profile) ? 'Membership Renewal Required' : 'Membership Required'}
                  </Label>
                </div>
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <p className="text-xs font-body font-bold text-primary">Tessera Associativa Scampagnate</p>
                  </div>
                  <div className="text-[10px] font-body text-primary/90 leading-relaxed space-y-2">
                    {isMembershipExpired(profile) ? (
                      <>
                        <p>
                          La tua tessera associativa è scaduta. Per continuare a partecipare alle attività è necessario rinnovare la tessera.
                        </p>
                        <p>
                          Il tuo numero di tessera <strong>#{profile?.membership_id}</strong> verrà mantenuto.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          Per partecipare alle attività organizzate dal Gruppo Scampagnate, è richiesta la tessera associativa annuale.
                        </p>
                        <p>
                          Dopo il pagamento riceverai il tuo numero di tessera personale. La tessera fisica verrà consegnata durante il tuo primo evento.
                        </p>
                      </>
                    )}
                    <p>
                      La quota associativa è di <strong>€10/anno</strong> e copre l'intero anno solare {new Date().getFullYear()}.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 4: Order Summary ── */}
            {event.payment_type !== "free" && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">{!isMembershipActive(profile) ? '4' : '3'}</span>
                  <Label className="font-body text-sm font-semibold">Order Summary</Label>
                </div>
                <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 space-y-1.5">
                  {(() => {
                    const selectedOpt = event.price_options?.find((o: any) => o.id === selectedPriceOption);
                    const basePrice = selectedOpt ? Number(selectedOpt.price) : Number(event.price);
                    const displayLabel = selectedOpt ? selectedOpt.name : "Event";
                    const isDeposit = (event.payment_type as string) === "deposit" && event.deposit && !selectedOpt;
                    const depositAmount = isDeposit ? Number(event.deposit) : 0;
                    const displayPrice = isDeposit ? depositAmount : basePrice;
                    const needsMembership = !isMembershipActive(profile);
                    const membershipFee = needsMembership ? 10 : 0;

                    // Calculate final event price after discount
                    const discountedEventPrice = appliedDiscount ? Number(appliedDiscount.final_price) : displayPrice;

                    return (
                      <>
                        {/* Event price line */}
                        <div className="flex justify-between text-sm font-body">
                          <span className="text-muted-foreground">{isDeposit ? `Deposit — ${displayLabel}` : displayLabel}</span>
                          <span className={`font-semibold ${appliedDiscount ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            €{displayPrice.toFixed(2)}
                          </span>
                        </div>

                        {/* Discount line */}
                        {appliedDiscount && (
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-success font-semibold flex items-center gap-1">
                              <Tag className="h-3 w-3" /> Discount applied
                            </span>
                            <span className="font-bold text-success">€{discountedEventPrice.toFixed(2)}</span>
                          </div>
                        )}

                        {/* Remaining balance for deposits */}
                        {isDeposit && (
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-muted-foreground">Remaining (pay later)</span>
                            <span className="text-muted-foreground">€{(Number(event.price) - depositAmount).toFixed(2)}</span>
                          </div>
                        )}

                        {/* Location payment note */}
                        {(event.payment_type as string) === "location" && (
                          <p className="text-xs font-body text-muted-foreground">Payment on location — no charge during registration.</p>
                        )}

                        {/* Membership fee line */}
                        {needsMembership && (
                          <div className="flex justify-between text-sm font-body">
                            <span className="text-primary font-semibold flex items-center gap-1">
                              <CreditCard className="h-3 w-3" /> Membership fee
                            </span>
                            <span className="font-semibold text-primary">€{membershipFee.toFixed(2)}</span>
                          </div>
                        )}

                        {/* Divider + Total */}
                        <div className="flex justify-between text-sm font-body pt-1.5 mt-1 border-t border-gold/20">
                          <span className="font-bold text-foreground">Total due today</span>
                          <span className="font-bold text-foreground text-base">
                            €{(discountedEventPrice + membershipFee).toFixed(2)}
                          </span>
                        </div>

                        {/* Payment method note */}
                        <p className="text-[10px] font-body text-muted-foreground pt-1">
                          {needsMembership
                            ? "Membership fee is included in this Stripe checkout."
                            : (event.payment_type === "paid" || selectedOpt)
                              ? "Full payment will be charged online via Stripe."
                              : isDeposit
                                ? "Deposit will be charged online via Stripe."
                                : (event.payment_type as string) === "location"
                                  ? ""
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
              onClick={() => handleRegister(isRequestingOverride)}
              disabled={
                registerMutation.isPending || membershipLoading ||
                (event.meeting_points && event.meeting_points.length > 0 && !selectedMeetingPoint) ||
                (event.price_options && event.price_options.length > 0 && !selectedPriceOption) ||
                (event.additional_fields && Array.isArray(event.additional_fields) && (event.additional_fields as any[]).some((f: any) => f.required && !additionalResponses[f.label]?.trim())) ||
                (event.equipment_list && Array.isArray(event.equipment_list) && (event.equipment_list as any[]).some((item: any) => item.is_mandatory) && !equipmentConfirmed)
              }
              className={`w-full font-body font-semibold ${event.status === "full" ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
            >
              {(registerMutation.isPending || membershipLoading) ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{membershipLoading ? "Redirecting to payment..." : isRequestingOverride ? "Submitting..." : "Registering..."}</>
              ) : !isMembershipActive(profile) ? (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {isMembershipExpired(profile) ? 'Renew Membership & Register' : 'Pay Membership & Register'}
                </>
              ) : event.status === "full" ? (
                "Join Waitlist"
              ) : isRequestingOverride ? (
                "Submit Request"
              ) : (
                "Confirm Registration"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Access Warning Dialog */}
      <Dialog open={showAccessWarning} onOpenChange={setShowAccessWarning}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Requisiti di accesso</DialogTitle>
            <DialogDescription className="font-body text-sm mt-2 text-foreground">
              {accessData?.restrictionMessage || "Questo evento ha dei requisiti di partecipazione."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {accessData?.failedRules && accessData.failedRules.length > 0 && (
              <div className="p-4 rounded-xl bg-muted/50 space-y-2 border border-border/50">
                <p className="text-xs font-body font-bold text-foreground">Requisiti non soddisfatti:</p>
                <ul className="text-xs font-body text-muted-foreground space-y-1.5 ml-4 list-disc">
                  {accessData.failedRules.map((fr: any, idx: number) => (
                    <li key={idx}>{fr.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm font-body text-muted-foreground leading-relaxed">
              Puoi comunque richiedere l'approvazione manuale dell'organizzatore oppure contattarlo direttamente per maggiori informazioni.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              {organizerProfile?.phone && (
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
                    Contatta l'organizzatore
                  </a>
                </Button>
              )}

              <Button
                onClick={() => {
                  setShowAccessWarning(false);
                  setIsRequestingOverride(true);
                  setShowRegisterDialog(true);
                }}
                variant="outline"
                className="w-full font-body h-12 border-warning/30 text-warning hover:bg-warning/5 hover:text-warning"
              >
                Richiedi approvazione manuale
              </Button>

              <Button
                variant="ghost"
                className="w-full font-body text-muted-foreground text-xs h-10"
                onClick={() => setShowAccessWarning(false)}
              >
                Chiudi
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
    </div>
  );
};

export default EventDetail;
