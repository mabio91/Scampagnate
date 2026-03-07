import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizerEvents } from "@/hooks/useOrganizerEvents";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Calendar, Users, TrendingUp, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const OrganizerDashboard = () => {
  const { user, isOrganizer, loading } = useAuth();
  const { data: events, isLoading } = useOrganizerEvents();

  if (loading) return null;
  if (!user || !isOrganizer) return <Navigate to="/" replace />;

  const upcomingEvents = events?.filter((e) => new Date(e.date) >= new Date()) || [];
  const pastEvents = events?.filter((e) => new Date(e.date) < new Date()) || [];
  const totalRegistrations = events?.reduce((sum, e) => sum + e.spots_taken, 0) || 0;

  return (
    <AppLayout>
      <div className="px-4 pt-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <Link to="/organizer/events/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold font-display text-foreground">{events?.length || 0}</p>
            <p className="text-[11px] text-muted-foreground font-body">Events</p>
          </Card>
          <Card className="p-3 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold font-display text-foreground">{totalRegistrations}</p>
            <p className="text-[11px] text-muted-foreground font-body">Registrations</p>
          </Card>
          <Card className="p-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold font-display text-foreground">{upcomingEvents.length}</p>
            <p className="text-[11px] text-muted-foreground font-body">Upcoming</p>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div>
          <h2 className="font-display text-lg font-bold text-foreground mb-3">Upcoming Events</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground font-body text-sm">No upcoming events</p>
              <Link to="/organizer/events/new">
                <Button variant="outline" size="sm" className="mt-3">Create your first event</Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <Link key={event.id} to={`/organizer/events/${event.id}`}>
                  <Card className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-sm text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground font-body">
                        {format(new Date(event.date), "dd MMM yyyy")} · {event.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={event.status === "full" ? "destructive" : "secondary"} className="text-[10px]">
                        {event.spots_taken}/{event.spots_total}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-3">Past Events</h2>
            <div className="space-y-2">
              {pastEvents.slice(0, 5).map((event) => (
                <Link key={event.id} to={`/organizer/events/${event.id}`}>
                  <Card className="p-3 flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-sm text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground font-body">
                        {format(new Date(event.date), "dd MMM yyyy")} · {event.spots_taken} participants
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default OrganizerDashboard;
