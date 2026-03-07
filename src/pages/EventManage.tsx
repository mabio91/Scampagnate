import { useState } from "react";
import { useParams, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEventRegistrations, useEventMeetingPoints } from "@/hooks/useOrganizerEvents";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, Users, CheckCircle2, Download, UserPlus, UserMinus, Loader2, Zap, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import EventAnalytics from "@/components/events/EventAnalytics";
import { useToast } from "@/hooks/use-toast";

const EventManage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOrganizer, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quickCheckIn, setQuickCheckIn] = useState(false);
  const [meetingPointFilter, setMeetingPointFilter] = useState<string>("all");

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_categories(name, icon)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: registrations, isLoading: regsLoading } = useEventRegistrations(id!);
  const { data: meetingPoints } = useEventMeetingPoints(id!);

  if (authLoading) return null;
  if (!user || !isOrganizer) return <Navigate to="/" replace />;

  const registered = registrations?.filter((r) => r.status === "registered" || r.status === "paid") || [];
  const waitlisted = registrations?.filter((r) => r.status === "waitlist") || [];
  const cancelled = registrations?.filter((r) => r.status === "cancelled") || [];
  const checkedIn = registered.filter((r) => r.checked_in);

  const filteredRegistered = meetingPointFilter === "all"
    ? registered
    : registered.filter((r) => r.meeting_point_id === meetingPointFilter);

  const handleCheckIn = async (regId: string, currentState: boolean) => {
    const { error } = await supabase
      .from("event_registrations")
      .update({ checked_in: !currentState })
      .eq("id", regId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", id] });
    }
  };

  const handleStatusChange = async (regId: string, newStatus: string) => {
    const { error } = await supabase
      .from("event_registrations")
      .update({ status: newStatus as any })
      .eq("id", regId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", id] });
      toast({ title: `Status updated to ${newStatus}` });
    }
  };

  const handlePromoteFromWaitlist = async (regId: string) => {
    await handleStatusChange(regId, "registered");
  };

  const handleCancelRegistration = async (regId: string) => {
    await handleStatusChange(regId, "cancelled");
  };

  const exportCSV = () => {
    if (!registered.length) return;
    const headers = ["First Name", "Last Name", "Phone", "Status", "Meeting Point", "Checked In", "Registered At"];
    const rows = registered.map((r) => {
      const mp = meetingPoints?.find((p) => p.id === r.meeting_point_id);
      return [
        (r.profiles as any)?.first_name || "",
        (r.profiles as any)?.last_name || "",
        (r.profiles as any)?.phone || "",
        r.status,
        mp?.name || "-",
        r.checked_in ? "Yes" : "No",
        format(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event?.title || "event"}-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (eventLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!event) return <Navigate to="/organizer" replace />;

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/organizer")} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-bold text-foreground truncate">{event.title}</h1>
            <p className="text-xs text-muted-foreground font-body">
              {format(new Date(event.date), "dd MMM yyyy")} · {event.time}
            </p>
          </div>
          <Link to={`/organizer/events/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Edit className="h-3.5 w-3.5" /> Edit
            </Button>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="p-2 text-center">
            <p className="text-lg font-bold font-display text-foreground">{registered.length}</p>
            <p className="text-[10px] text-muted-foreground font-body">Registered</p>
          </Card>
          <Card className="p-2 text-center">
            <p className="text-lg font-bold font-display text-foreground">{checkedIn.length}</p>
            <p className="text-[10px] text-muted-foreground font-body">Checked In</p>
          </Card>
          <Card className="p-2 text-center">
            <p className="text-lg font-bold font-display text-foreground">{waitlisted.length}</p>
            <p className="text-[10px] text-muted-foreground font-body">Waitlist</p>
          </Card>
          <Card className="p-2 text-center">
            <p className="text-lg font-bold font-display text-foreground">{event.spots_total - registered.length}</p>
            <p className="text-[10px] text-muted-foreground font-body">Available</p>
          </Card>
        </div>

        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="participants" className="flex-1">Participants</TabsTrigger>
            <TabsTrigger value="checkin" className="flex-1">Check-in</TabsTrigger>
            <TabsTrigger value="waitlist" className="flex-1">Waitlist</TabsTrigger>
          </TabsList>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-3 mt-3">
            <div className="flex items-center gap-2">
              {meetingPoints && meetingPoints.length > 0 && (
                <Select value={meetingPointFilter} onValueChange={setMeetingPointFilter}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Filter by meeting point" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All meeting points</SelectItem>
                    {meetingPoints.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 shrink-0">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>

            {regsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredRegistered.length === 0 ? (
              <p className="text-center text-muted-foreground font-body text-sm py-6">No participants yet</p>
            ) : (
              <div className="space-y-2">
                {filteredRegistered.map((reg) => {
                  const mp = meetingPoints?.find((p) => p.id === reg.meeting_point_id);
                  return (
                    <Card key={reg.id} className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {(reg.profiles as any)?.first_name?.[0] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground truncate">
                          {(reg.profiles as any)?.first_name} {(reg.profiles as any)?.last_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-body">
                          {(reg.profiles as any)?.phone || "No phone"} {mp ? `· ${mp.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={reg.checked_in ? "default" : "outline"} className="text-[10px]">
                          {reg.checked_in ? "✓" : reg.status}
                        </Badge>
                        <Select onValueChange={(v) => handleStatusChange(reg.id, v)}>
                          <SelectTrigger className="w-8 h-8 p-0 border-0">
                            <span className="sr-only">Actions</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="registered">Registered</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Check-in Tab */}
          <TabsContent value="checkin" className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <p className="font-body text-sm text-muted-foreground">
                {checkedIn.length} / {registered.length} checked in
              </p>
              <Button
                variant={quickCheckIn ? "default" : "outline"}
                size="sm"
                className="gap-1"
                onClick={() => setQuickCheckIn(!quickCheckIn)}
              >
                <Zap className="h-3.5 w-3.5" />
                Quick Mode
              </Button>
            </div>

            {registered.length === 0 ? (
              <p className="text-center text-muted-foreground font-body text-sm py-6">No participants to check in</p>
            ) : (
              <div className="space-y-2">
                {registered.map((reg) => (
                  <Card
                    key={reg.id}
                    className={`p-3 flex items-center gap-3 transition-colors cursor-pointer ${
                      reg.checked_in ? "bg-success/10 border-success/30" : "hover:bg-muted/50"
                    }`}
                    onClick={quickCheckIn ? () => handleCheckIn(reg.id, reg.checked_in) : undefined}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      reg.checked_in ? "bg-success text-success-foreground" : "bg-muted"
                    }`}>
                      {reg.checked_in ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">
                          {(reg.profiles as any)?.first_name?.[0] || "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold text-foreground truncate">
                        {(reg.profiles as any)?.first_name} {(reg.profiles as any)?.last_name}
                      </p>
                    </div>
                    {!quickCheckIn && (
                      <Button
                        variant={reg.checked_in ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleCheckIn(reg.id, reg.checked_in)}
                      >
                        {reg.checked_in ? "Undo" : "Check in"}
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Waitlist Tab */}
          <TabsContent value="waitlist" className="space-y-3 mt-3">
            {waitlisted.length === 0 ? (
              <p className="text-center text-muted-foreground font-body text-sm py-6">No one on the waitlist</p>
            ) : (
              <div className="space-y-2">
                {waitlisted.map((reg) => (
                  <Card key={reg.id} className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning text-xs font-bold">
                      {(reg.profiles as any)?.first_name?.[0] || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold text-foreground truncate">
                        {(reg.profiles as any)?.first_name} {(reg.profiles as any)?.last_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-body">
                        Joined {format(new Date(reg.created_at), "dd MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" className="gap-1 h-7 text-xs" onClick={() => handlePromoteFromWaitlist(reg.id)}>
                        <UserPlus className="h-3 w-3" /> Promote
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => handleCancelRegistration(reg.id)}>
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {cancelled.length > 0 && (
              <div className="mt-4">
                <h3 className="font-body text-sm font-semibold text-muted-foreground mb-2">Cancelled ({cancelled.length})</h3>
                <div className="space-y-1">
                  {cancelled.map((reg) => (
                    <div key={reg.id} className="flex items-center gap-2 px-3 py-2 text-muted-foreground opacity-60">
                      <span className="text-xs font-body">
                        {(reg.profiles as any)?.first_name} {(reg.profiles as any)?.last_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default EventManage;
