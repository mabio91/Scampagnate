import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import {
  CalendarDays, MapPin, Share2, Bookmark, BookmarkCheck, X,
  CalendarPlus, ChevronRight, Clock, Calendar, Mail, Loader2
} from "lucide-react";
import { parseCancellationPolicy, CANCELLATION_POLICIES } from "@/lib/cancellationPolicy";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { parseEventDateTime } from "@/lib/timezone";

const statusConfig: Record<string, { label: string; className: string }> = {
  registered: { label: "Registered", className: "bg-success/10 text-success" },
  paid: { label: "Paid", className: "bg-success/10 text-success" },
  waitlist: { label: "Waitlist", className: "bg-warning/10 text-warning" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  attended: { label: "Attended", className: "bg-primary/10 text-primary" },
  no_show: { label: "No-show", className: "bg-destructive/10 text-destructive" },
  past: { label: "Past", className: "bg-muted text-muted-foreground" },
  pending_approval: { label: "Pending", className: "bg-warning/10 text-warning" },
};

const fallbackRegistrationStatus = statusConfig.registered;

const getRegistrationStatusDisplay = (status: string | null | undefined) => {
  if (!status || !Object.prototype.hasOwnProperty.call(statusConfig, status)) {
    return fallbackRegistrationStatus;
  }

  return statusConfig[status];
};

const generateCalendarUrl = (event: any, type: "google" | "apple" | "outlook") => {
  // Parse start time explicitly in Europe/Rome, ensuring UTC string aligns correctly
  const startDate = parseEventDateTime(event.date, event.time);
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // default 3h

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

  // Apple / ICS download
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

  if (!user) {
    return (
      <AppLayout>
        <div className="px-4 py-12 text-center">
          <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">My Events</h1>
          <p className="text-muted-foreground font-body text-sm mb-4">Sign in to see your events.</p>
          <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground font-body">Sign In</Button>
        </div>
      </AppLayout>
    );
  }

  const now = new Date();
  const active = registrations?.filter((r: any) => r.status !== "cancelled") || [];
  const upcoming = active.filter((r: any) => new Date(r.events?.date) >= now);
  const past = active.filter((r: any) => new Date(r.events?.date) < now);
  const cancelled = registrations?.filter((r: any) => r.status === "cancelled") || [];

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <h1 className="font-display text-2xl font-bold text-foreground mb-4">My Events</h1>
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full">
            <TabsTrigger value="upcoming" className="flex-1 font-body">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past" className="flex-1 font-body">Past ({past.length})</TabsTrigger>
            <TabsTrigger value="saved" className="flex-1 font-body">
              <Bookmark className="h-3 w-3 mr-1" /> Saved ({savedEvents?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {isLoading ? (
              <div className="space-y-3 mt-4">{[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground font-body text-sm">No upcoming events.</p>
                <Button variant="outline" className="mt-3 font-body" onClick={() => navigate("/")}>Browse Events</Button>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {upcoming.map((r: any) => (
                  <EventRegistrationCard key={r.id} registration={r} showActions />
                ))}
              </div>
            )}
            {cancelled.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-body font-semibold text-muted-foreground mb-2">Cancelled ({cancelled.length})</p>
                <div className="space-y-2">
                  {cancelled.map((r: any) => (
                    <EventRegistrationCard key={r.id} registration={r} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {past.length === 0 ? (
              <p className="text-center text-muted-foreground font-body py-8 text-sm">No past events.</p>
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
                <p className="text-muted-foreground font-body text-sm">No saved events yet.</p>
                <p className="text-muted-foreground font-body text-xs mt-1">Tap the bookmark icon on any event to save it for later.</p>
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
    </AppLayout>
  );
};

const EventRegistrationCard = ({ registration, showActions, isPast }: { registration: any; showActions?: boolean; isPast?: boolean }) => {
  const event = registration.events;
  const { toast } = useToast();
  const cancelMutation = useCancelRegistration();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  if (!event) return null;
  // image handled by OptimizedImage component

  const displayStatus = isPast ? "past" : registration.status;
  const status = getRegistrationStatusDisplay(displayStatus);
  const meetingPoint = registration.meeting_point;
  const canCancel = showActions && registration.status !== "cancelled" && registration.status !== "waitlist";

  const eventUrl = `${window.location.origin}/event/${event.id}`;
  const shareText = `${event.title} - ${new Date(event.date).toLocaleDateString("it-IT")}`;
  const shareEvent = () => setShowShareSheet(true);

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(event.id);
      setShowCancelDialog(false);
      toast({ title: "Registration cancelled", description: "Your registration has been cancelled." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold ${status.className}`}>
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground text-xs font-body">
              <CalendarDays className="h-3 w-3" />
              {new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
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
          <div className="flex items-center gap-2 px-3 pb-3 pt-1">
            <button onClick={shareEvent} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-body font-medium hover:bg-muted/80 active:scale-95 transition-all">
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-body font-medium hover:bg-muted/80 active:scale-95 transition-all">
                  <CalendarPlus className="h-3.5 w-3.5" /> Calendar
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
            {canCancel && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-body font-medium hover:bg-destructive/20 active:scale-95 transition-all ml-auto"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cancel Confirmation */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Cancel Registration?</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Are you sure you want to cancel your registration for {event.title}?
              {event.cancellation_policy && (() => {
                const { policyType, customText } = parseCancellationPolicy(event.cancellation_policy);
                if (!policyType) return null;
                const pol = CANCELLATION_POLICIES[policyType];
                const label = policyType === "custom" ? customText || event.cancellation_policy : `${pol.label} — ${pol.description.split(".")[0]}.`;
                return <span className="block mt-2 text-xs font-semibold text-muted-foreground italic">{label}</span>;
              })()}
            </DialogDescription>

          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 font-body" onClick={() => setShowCancelDialog(false)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-body"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelling...</> : "Cancel Registration"}
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

  if (!event) return null;
  // image handled by OptimizedImage component
  const isPast = new Date(event.date) < new Date();

  const handleUnsave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleSave.mutateAsync({ eventId: event.id, isSaved: true });
      toast({ title: "Removed from saved events" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
            {new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
            {isPast && <span className="text-destructive text-[10px]">(past)</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-muted-foreground text-xs font-body">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{event.location}</span>
          </div>
          <div className="mt-1.5">
            <span className="font-body font-bold text-xs text-foreground">
              {Number(event.price) === 0 ? "Free" : `€${event.price}`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MyEvents;
