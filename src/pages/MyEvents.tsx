import { Link, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { CalendarDays, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyEvents } from "@/hooks/useEvents";
import { useEventImage } from "@/hooks/useEventImage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusLabels: Record<string, string> = {
  registered: "Registered",
  paid: "Paid",
  waitlist: "Waitlist",
};

const MyEvents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: registrations, isLoading } = useMyEvents();

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
  const upcoming = registrations?.filter((r: any) => new Date(r.events?.date) >= now) || [];
  const past = registrations?.filter((r: any) => new Date(r.events?.date) < now) || [];

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <h1 className="font-display text-2xl font-bold text-foreground mb-4">My Events</h1>
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full">
            <TabsTrigger value="upcoming" className="flex-1 font-body">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past" className="flex-1 font-body">Past ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">
            {isLoading ? (
              <div className="space-y-3 mt-4">{[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            ) : upcoming.length === 0 ? (
              <p className="text-center text-muted-foreground font-body py-8 text-sm">No upcoming events.</p>
            ) : (
              <div className="space-y-3 mt-4">
                {upcoming.map((r: any) => (
                  <EventRegistrationCard key={r.id} registration={r} />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="past">
            {past.length === 0 ? (
              <p className="text-center text-muted-foreground font-body py-8 text-sm">No past events.</p>
            ) : (
              <div className="space-y-3 mt-4">
                {past.map((r: any) => (
                  <EventRegistrationCard key={r.id} registration={r} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

const EventRegistrationCard = ({ registration }: { registration: any }) => {
  const event = registration.events;
  if (!event) return null;
  const imageSrc = useEventImage(event.image_url || "trekking");
  const statusLabel = statusLabels[registration.status] || registration.status;

  return (
    <Link to={`/event/${event.id}`} className="block">
      <div className="flex gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-colors">
        <img src={imageSrc} alt={event.title} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-foreground truncate">{event.title}</h3>
            <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold bg-success/10 text-success">
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-xs font-body">
            <CalendarDays className="h-3 w-3" />
            {new Date(event.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-muted-foreground text-xs font-body">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{event.location}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MyEvents;
