import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity, CalendarCheck, CalendarX, AlertCircle, Clock, CheckCircle2
} from "lucide-react";

export const ActivityHistory = () => {
  const { user } = useAuth();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["user-activity-history", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Fetch all registrations for this user joined with the event data
      const { data, error } = await supabase
        .from("event_registrations")
        .select("status, checked_in, events(date, time)")
        .eq("user_id", user.id);

      if (error) throw error;

      const now = new Date();
      let joined = 0;
      let attended = 0;
      let waitlisted = 0;
      let cancelled = 0;
      let noShows = 0;

      data?.forEach((reg: any) => {
        const eventDate = reg.events?.date && reg.events?.time
          ? new Date(`${reg.events.date}T${reg.events.time}`)
          : null;
        
        const isPast = eventDate ? eventDate < now : false;

        // Joined: currently registered or paid
        if (reg.status === "registered" || reg.status === "paid") {
          joined++;
        }

        // Attended: checked in physically
        if (reg.checked_in) {
          attended++;
        }

        // Waitlisted: currently on waitlist
        if (reg.status === "waitlist") {
          waitlisted++;
        }

        // Cancelled: explicitly cancelled
        if (reg.status === "cancelled") {
          cancelled++;
        }

        // No-shows: holds a spot for a past event but wasn't checked in
        if ((reg.status === "registered" || reg.status === "paid") && isPast && !reg.checked_in) {
          noShows++;
        }
      });

      return { joined, attended, waitlisted, cancelled, noShows };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded mb-3"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="mb-6">
      <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        <Activity className="h-5 w-5 text-secondary" /> Activity History
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        
        {/* Joined */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center justify-center text-center">
          <CalendarCheck className="h-5 w-5 text-primary mb-1.5" />
          <span className="text-xl font-display font-bold text-foreground">{metrics.joined}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Events Joined</span>
        </div>

        {/* Attended */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center justify-center text-center">
          <CheckCircle2 className="h-5 w-5 text-success mb-1.5" />
          <span className="text-xl font-display font-bold text-foreground">{metrics.attended}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Events Attended</span>
        </div>

        {/* Waitlisted */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center justify-center text-center">
          <Clock className="h-5 w-5 text-warning mb-1.5" />
          <span className="text-xl font-display font-bold text-foreground">{metrics.waitlisted}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Waitlists</span>
        </div>

        {/* Cancelled */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center justify-center text-center">
          <CalendarX className="h-5 w-5 text-destructive mb-1.5" />
          <span className="text-xl font-display font-bold text-foreground">{metrics.cancelled}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cancellations</span>
        </div>

        {/* No Shows */}
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-5 w-5 text-destructive mb-1.5" />
          <span className="text-xl font-display font-bold text-foreground">{metrics.noShows}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">No-Shows</span>
        </div>

      </div>
    </div>
  );
};
