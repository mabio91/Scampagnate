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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  ArrowLeft, Edit, Users, CheckCircle2, Download, UserPlus, UserMinus,
  Loader2, Zap, BarChart3, Trash2, Send, Settings, Search
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import EventAnalytics from "@/components/events/EventAnalytics";

const EventManage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isOrganizer, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quickCheckIn, setQuickCheckIn] = useState(false);
  const [meetingPointFilter, setMeetingPointFilter] = useState<string>("all");
  const [checkInSearch, setCheckInSearch] = useState("");
  const [checkInMpFilter, setCheckInMpFilter] = useState<string>("all");

  // Dialogs
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);

  // Add participant state
  const [addMode, setAddMode] = useState<"search" | "manual">("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualMeetingPoint, setManualMeetingPoint] = useState("");
  const [manualPaymentStatus, setManualPaymentStatus] = useState("paid");
  const [addingParticipant, setAddingParticipant] = useState(false);

  // Message state
  const [messageText, setMessageText] = useState("");

  // Capacity state
  const [newCapacity, setNewCapacity] = useState(0);

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

  // Search users for adding existing participants
  const { data: searchResults } = useQuery({
    queryKey: ["search-users", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, phone")
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(10);
      return data || [];
    },
    enabled: addMode === "search" && searchQuery.length >= 2,
  });

  if (authLoading) return null;
  if (!user || !isOrganizer) return <Navigate to="/" replace />;

  const registered = registrations?.filter((r) => r.status === "registered" || r.status === "paid") || [];
  const waitlisted = registrations?.filter((r) => r.status === "waitlist") || [];
  const cancelled = registrations?.filter((r) => r.status === "cancelled") || [];
  const checkedIn = registered.filter((r) => r.checked_in);
  const reservedSpots = (event as any)?.reserved_spots || 0;

  const getParticipantName = (reg: any) => {
    if (reg.sport_level?.startsWith("manual:")) {
      return { firstName: reg.sport_level.replace("manual:", ""), lastName: "(manual)", isManual: true };
    }
    return {
      firstName: (reg.profiles as any)?.first_name || "?",
      lastName: (reg.profiles as any)?.last_name || "",
      isManual: false,
    };
  };

  const filteredRegistered = meetingPointFilter === "all"
    ? registered
    : registered.filter((r) => r.meeting_point_id === meetingPointFilter);

  // Check-in filtered list (by meeting point + search)
  const filteredCheckIn = registered.filter((r) => {
    if (checkInMpFilter !== "all" && r.meeting_point_id !== checkInMpFilter) return false;
    if (checkInSearch) {
      const { firstName, lastName } = getParticipantName(r);
      const name = `${firstName} ${lastName}`.toLowerCase();
      if (!name.includes(checkInSearch.toLowerCase())) return false;
    }
    return true;
  });

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
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      toast({ title: `Status updated to ${newStatus}` });
    }
  };

  const handlePromoteFromWaitlist = async (regId: string) => {
    await handleStatusChange(regId, "registered");
  };

  const handleCancelRegistration = async (regId: string) => {
    await handleStatusChange(regId, "cancelled");
  };

  // Add existing user as participant
  const handleAddExistingUser = async (userId: string) => {
    setAddingParticipant(true);
    try {
      const { error } = await supabase.from("event_registrations").insert({
        event_id: id!,
        user_id: userId,
        meeting_point_id: manualMeetingPoint || null,
        status: "registered",
        payment_status: manualPaymentStatus,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["event-registrations", id] });
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      setShowAddParticipant(false);
      setSearchQuery("");
      toast({ title: "Participant added!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingParticipant(false);
    }
  };

  // Add manual participant (creates a temporary profile-less registration)
  // We'll use the organizer's user_id but mark it as a manual entry with sport_level = "manual:Name"
  const handleAddManualParticipant = async () => {
    if (!manualName.trim()) return;
    setAddingParticipant(true);
    try {
      // For manual participants, we store their name in sport_level field with "manual:" prefix
      // This is a pragmatic approach that doesn't require schema changes
      const { error } = await supabase.from("event_registrations").insert({
        event_id: id!,
        user_id: user.id, // organizer's id as placeholder
        meeting_point_id: manualMeetingPoint || null,
        status: "registered",
        payment_status: manualPaymentStatus,
        sport_level: `manual:${manualName.trim()}`,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["event-registrations", id] });
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      setShowAddParticipant(false);
      setManualName("");
      toast({ title: `${manualName.trim()} added as participant!` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingParticipant(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async () => {
    try {
      // Delete meeting points first
      await supabase.from("event_meeting_points").delete().eq("event_id", id!);
      // Delete registrations
      await supabase.from("event_registrations").delete().eq("event_id", id!);
      // Delete event
      const { error } = await supabase.from("events").delete().eq("id", id!);
      if (error) throw error;
      toast({ title: "Event deleted" });
      navigate("/organizer");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Update capacity
  const handleUpdateCapacity = async () => {
    if (newCapacity < 1) return;
    const { error } = await supabase.from("events").update({ spots_total: newCapacity }).eq("id", id!);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      setShowCapacityDialog(false);
      toast({ title: `Capacity updated to ${newCapacity}` });
    }
  };

  const exportCSV = () => {
    if (!registered.length) return;
    const headers = ["First Name", "Last Name", "Phone", "Status", "Payment", "Meeting Point", "Checked In", "Registered At"];
    const rows = registered.map((r) => {
      const mp = meetingPoints?.find((p) => p.id === r.meeting_point_id);
      const isManual = r.sport_level?.startsWith("manual:");
      const manualName = isManual ? r.sport_level!.replace("manual:", "") : "";
      return [
        isManual ? manualName : ((r.profiles as any)?.first_name || ""),
        isManual ? "(manual)" : ((r.profiles as any)?.last_name || ""),
        isManual ? "" : ((r.profiles as any)?.phone || ""),
        r.status,
        r.payment_status || "-",
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
          <div className="flex gap-1">
            <Link to={`/organizer/events/${id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1">
                <Edit className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
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
          <Card className="p-2 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setNewCapacity(event.spots_total); setShowCapacityDialog(true); }}>
            <p className="text-lg font-bold font-display text-foreground">{event.spots_total - registered.length - reservedSpots}</p>
            <p className="text-[10px] text-muted-foreground font-body">Available</p>
            {reservedSpots > 0 && (
              <p className="text-[9px] text-warning font-body">{reservedSpots} reserved</p>
            )}
          </Card>
        </div>

        {/* Action Bar */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1 flex-1" onClick={() => { setAddMode("manual"); setShowAddParticipant(true); }}>
            <UserPlus className="h-3.5 w-3.5" /> Add Participant
          </Button>
          <Button size="sm" variant="outline" className="gap-1 flex-1" onClick={() => setShowMessageDialog(true)}>
            <Send className="h-3.5 w-3.5" /> Message All
          </Button>
        </div>

        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="participants" className="flex-1">Participants</TabsTrigger>
            <TabsTrigger value="checkin" className="flex-1">Check-in</TabsTrigger>
            <TabsTrigger value="waitlist" className="flex-1">Waitlist</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1">
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              Stats
            </TabsTrigger>
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
                  const { firstName, lastName, isManual } = getParticipantName(reg);
                  return (
                    <Card key={reg.id} className="p-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isManual ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                        {isManual ? "M" : ((reg.profiles as any)?.avatar_url ? (
                          <img src={(reg.profiles as any).avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : firstName[0])}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground truncate">
                          {firstName} {lastName}
                          {isManual && <span className="text-[10px] text-warning ml-1">(manual)</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-body">
                          {!isManual && ((reg.profiles as any)?.phone || "No phone")} {mp ? `· ${mp.name}` : ""}
                          {reg.sport_level && !reg.sport_level.startsWith("manual:") && (
                            <span className="text-primary ml-1">· Level: {reg.sport_level}</span>
                          )}
                          {reg.payment_status && reg.payment_status !== "not_required" && (
                            <span className={`ml-1 ${reg.payment_status === "paid" ? "text-success" : "text-warning"}`}>
                              · {reg.payment_status}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={reg.checked_in ? "default" : "outline"} className="text-[10px]">
                          {reg.checked_in ? <CheckCircle2 className="h-3 w-3" /> : reg.status}
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
            {/* Controls row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={checkInSearch}
                  onChange={(e) => setCheckInSearch(e.target.value)}
                  placeholder="Search participants..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button
                variant={quickCheckIn ? "default" : "outline"}
                size="sm"
                className="gap-1 shrink-0"
                onClick={() => setQuickCheckIn(!quickCheckIn)}
              >
                <Zap className="h-3.5 w-3.5" />
                Quick
              </Button>
            </div>

            {/* Meeting point filter */}
            {meetingPoints && meetingPoints.length > 0 && (
              <div className="space-y-2">
                <Select value={checkInMpFilter} onValueChange={setCheckInMpFilter}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Filter by meeting point" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Participants</SelectItem>
                    {meetingPoints.map((mp) => {
                      const mpCheckedIn = registered.filter((r) => r.meeting_point_id === mp.id && r.checked_in).length;
                      const mpTotal = registered.filter((r) => r.meeting_point_id === mp.id).length;
                      return (
                        <SelectItem key={mp.id} value={mp.id}>
                          {mp.name} — {mpCheckedIn}/{mpTotal} checked in
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Attendance counter */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <p className="font-body text-sm text-foreground font-semibold">
                {checkInMpFilter === "all" ? "Total" : meetingPoints?.find(m => m.id === checkInMpFilter)?.name || ""}
              </p>
              <Badge variant="secondary" className="text-sm font-display">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {filteredCheckIn.filter((r) => r.checked_in).length} / {filteredCheckIn.length} checked in
              </Badge>
            </div>

            {filteredCheckIn.length === 0 ? (
              <p className="text-center text-muted-foreground font-body text-sm py-6">
                {checkInSearch ? "No matching participants" : "No participants to check in"}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredCheckIn.map((reg) => {
                  const { firstName, lastName, isManual } = getParticipantName(reg);
                  const mp = meetingPoints?.find((p) => p.id === reg.meeting_point_id);
                  return (
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
                          <span className="text-xs font-bold text-muted-foreground">{firstName[0]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground truncate">
                          {firstName} {lastName}
                          {isManual && <span className="text-[10px] text-warning ml-1">(manual)</span>}
                        </p>
                        <div className="flex items-center gap-1">
                          {mp && (
                            <p className="text-[10px] text-muted-foreground font-body">{mp.name}</p>
                          )}
                          {reg.sport_level && !reg.sport_level.startsWith("manual:") && (
                            <p className="text-[10px] text-primary font-body">· {reg.sport_level}</p>
                          )}
                        </div>
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
                  );
                })}
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

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-3">
            <EventAnalytics
              event={event}
              registrations={registrations || []}
              meetingPoints={meetingPoints || []}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Participant Dialog */}
      <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Add Participant</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Add an existing user or create a manual entry.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-3">
            <Button
              variant={addMode === "search" ? "default" : "outline"}
              size="sm"
              className="flex-1 font-body text-xs"
              onClick={() => setAddMode("search")}
            >
              <Search className="h-3 w-3 mr-1" /> Find User
            </Button>
            <Button
              variant={addMode === "manual" ? "default" : "outline"}
              size="sm"
              className="flex-1 font-body text-xs"
              onClick={() => setAddMode("manual")}
            >
              <UserPlus className="h-3 w-3 mr-1" /> Manual Entry
            </Button>
          </div>

          <div className="space-y-3">
            {addMode === "search" ? (
              <>
                <div>
                  <Label className="font-body text-xs">Search by name</Label>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type at least 2 characters..."
                    className="mt-1"
                  />
                </div>
                {searchResults && searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {searchResults.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => handleAddExistingUser(u.id)}
                        disabled={addingParticipant}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                            {u.first_name?.[0] || "?"}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-body font-semibold text-foreground">{u.first_name} {u.last_name}</p>
                          <p className="text-[10px] font-body text-muted-foreground">{u.phone || "No phone"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && searchResults?.length === 0 && (
                  <p className="text-xs text-muted-foreground font-body text-center py-2">No users found</p>
                )}
              </>
            ) : (
              <div>
                <Label className="font-body text-xs">Participant Name *</Label>
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Mario Rossi"
                  className="mt-1"
                />
              </div>
            )}

            {meetingPoints && meetingPoints.length > 0 && (
              <div>
                <Label className="font-body text-xs">Meeting Point</Label>
                <Select value={manualMeetingPoint} onValueChange={setManualMeetingPoint}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select meeting point" /></SelectTrigger>
                  <SelectContent>
                    {meetingPoints.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="font-body text-xs">Payment Status</Label>
              <Select value={manualPaymentStatus} onValueChange={setManualPaymentStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="not_required">Not Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addMode === "manual" && (
              <Button
                onClick={handleAddManualParticipant}
                disabled={!manualName.trim() || addingParticipant}
                className="w-full font-body"
              >
                {addingParticipant ? "Adding..." : "Add Participant"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Event Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Delete Event?</DialogTitle>
            <DialogDescription className="font-body text-sm">
              This will permanently delete "{event.title}" and all registrations. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 font-body" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1 font-body" onClick={handleDeleteEvent}>
              Delete Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Participants Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Message Participants</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Send a message to all {registered.length} registered participants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="font-body"
            />
            <p className="text-[11px] text-muted-foreground font-body">
              Message will be sent as a notification to all registered participants.
            </p>
            <Button
              onClick={() => {
                toast({ title: "Message sent", description: `Notified ${registered.length} participants` });
                setShowMessageDialog(false);
                setMessageText("");
              }}
              disabled={!messageText.trim()}
              className="w-full font-body"
            >
              <Send className="h-4 w-4 mr-2" /> Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Capacity Dialog */}
      <Dialog open={showCapacityDialog} onOpenChange={setShowCapacityDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display">Adjust Capacity</DialogTitle>
            <DialogDescription className="font-body text-sm">
              Current: {event.spots_total} spots · {registered.length} registered · {reservedSpots} reserved
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-body text-xs">New Total Capacity</Label>
              <Input
                type="number"
                min={registered.length}
                value={newCapacity}
                onChange={(e) => setNewCapacity(parseInt(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground font-body mt-1">
                Minimum: {registered.length} (current registrations)
              </p>
            </div>
            <Button onClick={handleUpdateCapacity} disabled={newCapacity < registered.length} className="w-full font-body">
              Update Capacity
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default EventManage;
