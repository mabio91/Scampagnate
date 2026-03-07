import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CalendarDays, MapPin, Users, Clock, Mountain,
  Route, Share2, Navigation, ChevronRight, Heart, Bookmark, BookmarkCheck, CalendarPlus,
  Calendar, Apple, Mail, Map, Car, MapPinned, MessageCircle, Phone, User as UserIcon
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEvent, useEventParticipants, useMyRegistration, useRegisterForEvent, useCancelRegistration, useSavedEvents, useToggleSaveEvent } from "@/hooks/useEvents";
import { BadgeIcon as BadgeIconComp } from "@/components/BadgeIcon";
import ShareSheet from "@/components/events/ShareSheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState("");
  const [sportLevel, setSportLevel] = useState("");
  const [additionalResponses, setAdditionalResponses] = useState<Record<string, string>>({});

  // Fetch organizer profile for contact info
  const { data: organizerProfile } = useQuery({
    queryKey: ["organizer-profile", event?.organizer_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone, avatar_url")
        .eq("id", event!.organizer_id!)
        .single();
      return data;
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
        <p className="text-muted-foreground font-body">Event not found</p>
        <Link to="/" className="text-primary font-body mt-2">Back to Home</Link>
      </div>
    );
  }

  const imageSrc = useEventImage(event.image_url || "trekking");
  const isRegistered = myRegistration && myRegistration.status !== "cancelled";
  const isSportCategory = event.category?.name === "Sport & Movimento";
  const isSaved = savedEvents?.some((se: any) => se.event_id === event.id) || false;

  const handleToggleSave = async () => {
    if (!user) { navigate("/auth"); return; }
    try {
      await toggleSaveMutation.mutateAsync({ eventId: event.id, isSaved });
      toast({ title: isSaved ? "Removed from saved" : "Saved to wishlist" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const generateCalUrl = (type: "google" | "apple" | "outlook") => {
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
    if (type === "outlook") {
      return `https://outlook.live.com/calendar/0/action/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${location}&body=${details}`;
    }
    const ics = ["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT",`DTSTART:${formatICS(startDate)}`,`DTEND:${formatICS(endDate)}`,`SUMMARY:${event.title}`,`LOCATION:${event.location}`,`DESCRIPTION:Event page: ${eventUrl}`,`URL:${eventUrl}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
    return URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  };

  const handleAddToCalendar = (type: "google" | "apple" | "outlook") => {
    const url = generateCalUrl(type);
    if (type === "apple") {
      const a = document.createElement("a"); a.href = url; a.download = `${event.title}.ics`; a.click(); URL.revokeObjectURL(url);
    } else { window.open(url, "_blank"); }
  };

  const handleCTA = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (event.status === "closed") return;
    if (isRegistered && myRegistration?.status !== "waitlist" && (event.payment_type === "free" || myRegistration?.payment_status === "paid")) return;

    // Pay Now - placeholder for payment flow
    if (isRegistered && event.payment_type !== "free" && myRegistration?.payment_status !== "paid") {
      toast({ title: "Payment", description: "Payment flow coming soon!" });
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
        paymentType: event.payment_type,
      });
      setShowRegisterDialog(false);
      if (isWaitlist) {
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

  const needsPayment = isRegistered && event.payment_type !== "free" && myRegistration?.payment_status !== "paid";
  const isOnWaitlist = isRegistered && myRegistration?.status === "waitlist";

  const getCTALabel = () => {
    if (event.status === "closed") return "Event Closed";
    if (isOnWaitlist) return "On Waitlist";
    if (needsPayment) return "Pay Now";
    if (isRegistered) return "Registered";
    if (event.status === "full") return "Join Waitlist";
    return "Join Event";
  };

  const getCTAClass = () => {
    if (event.status === "closed") return "bg-muted text-muted-foreground cursor-not-allowed";
    if (isOnWaitlist) return "bg-warning/20 text-warning border border-warning/30";
    if (needsPayment) return "bg-accent text-accent-foreground hover:bg-accent/90";
    if (isRegistered) return "bg-success text-success-foreground";
    if (event.status === "full") return "bg-secondary text-secondary-foreground hover:bg-secondary/90";
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
        <button className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-sm font-body font-semibold hover:bg-secondary/20 transition-colors ${className}`}>
          <Navigation className="h-4 w-4" />
          Get Directions
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
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative">
        <img src={imageSrc} alt={event.title} className="w-full h-72 object-cover" />
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
              <span className="inline-block px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-body font-semibold">
                {event.difficulty}
              </span>
            )}
            {event.category && (
              <span className="inline-block px-2.5 py-1 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground text-xs font-body font-semibold">
                {event.category.name}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-bold text-primary-foreground">{event.title}</h1>
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
          <div className="flex items-center gap-2">
            <DirectionsButton location={event.location} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-sm font-body font-semibold hover:bg-secondary/20 transition-colors">
                  <CalendarPlus className="h-4 w-4" />
                  Add to Calendar
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
              <p className="text-[10px] text-muted-foreground font-body">Distance</p>
            </div>
            <div className="text-center">
              <Mountain className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.elevation}</p>
              <p className="text-[10px] text-muted-foreground font-body">Elevation</p>
            </div>
            <div className="text-center">
              <Clock className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.duration}</p>
              <p className="text-[10px] text-muted-foreground font-body">Duration</p>
            </div>
            <div className="text-center">
              <Users className="h-5 w-5 mx-auto text-secondary mb-1" />
              <p className="text-sm font-body font-bold text-foreground">{event.spots_taken}/{event.spots_total}</p>
              <p className="text-[10px] text-muted-foreground font-body">Spots</p>
            </div>
          </motion.div>
        )}

        {/* Description */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="py-4 border-b border-border">
          <h3 className="font-display text-lg font-bold text-foreground mb-2">Description</h3>
          <p className="text-sm font-body text-muted-foreground leading-relaxed">{event.description}</p>
        </motion.div>

        {/* Meeting Points - names stay Italian */}
        {event.meeting_points && event.meeting_points.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="py-4 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground mb-3">Meeting Points</h3>
            <div className="space-y-3">
              {event.meeting_points.map((mp) => (
                <div key={mp.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body font-semibold text-foreground">{mp.name}</p>
                    <p className="text-xs font-body text-muted-foreground">{mp.location} · {mp.time?.slice(0, 5)}</p>
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
            <span className="text-sm font-body text-muted-foreground">{event.spots_taken} / {event.spots_total} joined</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted mb-3">
            <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${Math.min(100, (event.spots_taken / event.spots_total) * 100)}%` }} />
          </div>

          {/* Guest view: only count */}
          {!user && (
            <p className="text-sm font-body text-muted-foreground">
              {event.spots_taken > 0
                ? `${event.spots_taken} participant${event.spots_taken > 1 ? "s" : ""} already joined. Sign in to see who's going.`
                : "No participants yet. Sign in to see who joins."}
            </p>
          )}

          {/* Logged-in user view: social preview with badges */}
          {user && participants && participants.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-body text-muted-foreground mb-2">Participants already joined:</p>
              <div className="flex flex-wrap gap-2">
                {participants.slice(0, 6).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-body">
                    {p.profiles?.avatar_url ? (
                      <img src={p.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                        {p.profiles?.first_name?.[0] || "?"}
                      </span>
                    )}
                    <span className="text-foreground">{p.profiles?.first_name}</span>
                    {p.badges && p.badges.length > 0 && (
                      <span className="flex items-center gap-0.5" title={p.badges.map((b: any) => b.name).join(", ")}>
                        {p.badges.slice(0, 2).map((b: any, i: number) => (
                          <BadgeIconComp key={i} icon={b.icon} className="h-3.5 w-3.5 text-primary" />
                        ))}
                      </span>
                    )}
                  </div>
                ))}
                {participants.length > 6 && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-sm font-body text-muted-foreground">
                    +{participants.length - 6} others <ChevronRight className="h-3 w-3" />
                  </div>
                )}
              </div>

              {/* Organizer-only: detailed list with meeting points */}
              {(user.id === event.organizer_id) && event.meeting_points && event.meeting_points.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-body font-semibold text-muted-foreground mb-2">Meeting point assignments:</p>
                  <div className="space-y-1">
                    {participants.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between text-xs font-body px-2 py-1.5 rounded-lg bg-muted/30">
                        <span className="text-foreground font-medium">
                          {p.profiles?.first_name} {p.profiles?.last_name}
                        </span>
                        <span className="text-muted-foreground">
                          {p.meeting_point?.name || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {user && (!participants || participants.length === 0) && (
            <p className="text-sm font-body text-muted-foreground">No participants yet</p>
          )}
        </motion.div>

        {/* Organizer */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="py-4 border-b border-border">
          <h3 className="font-display text-lg font-bold text-foreground mb-3">Organizer</h3>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-body font-bold">
              {event.organizer_name?.[0] || "O"}
            </div>
            <div>
              <p className="text-sm font-body font-semibold text-foreground">{event.organizer_name}</p>
              <p className="text-xs font-body text-muted-foreground">Event Organizer</p>
            </div>
          </div>
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
          {event.cancellation_policy && (
            <div className="p-3 rounded-xl bg-muted/50 mb-4">
              <p className="text-sm font-body font-semibold text-foreground">Cancellation & Refund Policy</p>
              <p className="text-xs font-body text-muted-foreground mt-1">{event.cancellation_policy}</p>
              {event.payment_type === "deposit" && (
                <p className="text-xs font-body text-muted-foreground mt-1 italic">
                  Deposit refund is subject to this cancellation policy.
                </p>
              )}
            </div>
          )}
          {isRegistered && (
            <Button variant="outline" onClick={handleCancel} disabled={cancelMutation.isPending} className="w-full border-destructive text-destructive hover:bg-destructive/10">
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Registration"}
            </Button>
          )}
        </motion.div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border p-4 pb-safe z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-body text-muted-foreground">
              {(event.payment_type as string) === "deposit" ? "From" : "Price"}
            </p>
            <p className="text-xl font-display font-bold text-foreground">
              {Number(event.price) === 0 ? "Free" : (event.payment_type as string) === "deposit" && event.deposit ? `€${event.deposit}` : `€${event.price}`}
            </p>
            {(event.payment_type as string) === "deposit" && event.deposit && (
              <p className="text-[10px] font-body text-muted-foreground">deposit · €{event.price} total</p>
            )}
            {(event.payment_type as string) === "location" && Number(event.price) > 0 && (
              <p className="text-[10px] font-body text-muted-foreground">pay on location</p>
            )}
          </div>
          <Button
            onClick={handleCTA}
            className={`px-8 py-3 rounded-xl font-body font-semibold text-base ${getCTAClass()}`}
            disabled={event.status === "closed" || (isRegistered && !needsPayment && !isOnWaitlist)}
          >
            {getCTALabel()}
          </Button>
        </div>
      </div>

      {/* Registration Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Register for {event.title}</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Complete your registration by selecting the required options.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Meeting point names stay Italian */}
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

            {isSportCategory && (
              <div>
                <Label className="font-body text-sm font-semibold">Sport Level (optional)</Label>
                <Input
                  value={sportLevel}
                  onChange={(e) => setSportLevel(e.target.value)}
                  placeholder="e.g. Intermediate, 3.5"
                  className="mt-1"
                />
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

            {event.payment_type !== "free" && (
              <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 space-y-1">
                {(event.payment_type as string) === "deposit" && event.deposit ? (
                  <>
                    <div className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Deposit (pay now)</span>
                      <span className="font-semibold text-foreground">€{Number(event.deposit).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">Remaining (pay later)</span>
                      <span className="text-foreground">€{(Number(event.price) - Number(event.deposit)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-body pt-1 border-t border-gold/20">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-bold text-foreground">€{Number(event.price).toFixed(2)}</span>
                    </div>
                  </>
                ) : (event.payment_type as string) === "location" ? (
                  <>
                    <p className="text-sm font-body font-semibold text-foreground">€{Number(event.price).toFixed(2)}</p>
                    <p className="text-xs font-body text-muted-foreground">Payment on location — no charge during registration.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-body font-semibold text-foreground">Total: €{Number(event.price).toFixed(2)}</p>
                    <p className="text-xs font-body text-muted-foreground">Full payment will be charged online via Stripe.</p>
                  </>
                )}
              </div>
            )}

            <Button
              onClick={handleRegister}
              disabled={
                registerMutation.isPending ||
                (event.meeting_points && event.meeting_points.length > 0 && !selectedMeetingPoint) ||
                (event.additional_fields && Array.isArray(event.additional_fields) && (event.additional_fields as any[]).some((f: any) => f.required && !additionalResponses[f.label]?.trim()))
              }
              className={`w-full font-body font-semibold ${event.status === "full" ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
            >
              {registerMutation.isPending ? "Registering..." : event.status === "full" ? "Join Waitlist" : "Confirm Registration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetail;
