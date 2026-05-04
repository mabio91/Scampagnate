import { useState, useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizerEvents } from "@/hooks/useOrganizerEvents";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Calendar, Users, TrendingUp, ChevronRight, CheckCircle2,
  UserX, Award, BarChart3, Target, XCircle, AlertTriangle, Copy, Trash2, Lightbulb, Ticket, Link2
} from "lucide-react";
import IssuesPanel from "@/components/admin/IssuesPanel";
import ProposalsPanel from "@/components/admin/ProposalsPanel";
import DiscountCodesPanel from "@/components/admin/DiscountCodesPanel";
import MissionsPanel from "@/components/admin/MissionsPanel";
import BroadcastTemplatesPanel from "@/components/admin/BroadcastTemplatesPanel";
import { format } from "date-fns";
import { isActiveParticipantRegistration } from "@/lib/eventPayments";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, AreaChart, Area, Legend, CartesianGrid,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  fontSize: 12,
};

const OrganizerDashboard = () => {
  const navigate = useNavigate();
  const { user, isOrganizer, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const { data: events, isLoading } = useOrganizerEvents();

  // Fetch all registrations for organizer's events
  const eventIds = events?.map((e) => e.id) || [];
  const { data: allRegistrations } = useQuery({
    queryKey: ["organizer-all-registrations", eventIds],
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("id, event_id, status, payment_status, checked_in, created_at")
        .in("event_id", eventIds);
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const upcomingEvents = events?.filter((e) => new Date(e.date) >= now) || [];
  const pastEvents = events?.filter((e) => new Date(e.date) < now) || [];

  // Aggregate analytics
  const analytics = useMemo(() => {
    if (!events?.length || !allRegistrations) return null;

    const totalEvents = events.length;
    const pe = events.filter((e) => new Date(e.date) < new Date());
    const totalPast = pe.length;

    const regsByEvent: Record<string, typeof allRegistrations> = {};
    allRegistrations.forEach((r) => {
      if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = [];
      regsByEvent[r.event_id].push(r);
    });

    let totalRegistered = 0;
    let totalCheckedIn = 0;
    let totalCancelled = 0;
    let totalNoShows = 0;

    const pastEventStats = pe.map((evt) => {
      const regs = regsByEvent[evt.id] || [];
      const active = regs.filter(isActiveParticipantRegistration);
      const checkedIn = active.filter((r) => r.checked_in);
      const noShows = active.filter((r) => !r.checked_in);
      const cancelled = regs.filter((r) => r.status === "cancelled");

      totalRegistered += active.length;
      totalCheckedIn += checkedIn.length;
      totalCancelled += cancelled.length;
      totalNoShows += noShows.length;

      return {
        id: evt.id,
        title: evt.title,
        date: evt.date,
        category: (evt.event_categories as any)?.name || "—",
        spotsTotal: evt.spots_total,
        registered: active.length,
        checkedIn: checkedIn.length,
        noShows: noShows.length,
        cancelled: cancelled.length,
        attendanceRate: active.length > 0 ? Math.round((checkedIn.length / active.length) * 100) : 0,
      };
    });

    const avgParticipants = totalPast > 0 ? Math.round(totalRegistered / totalPast) : 0;
    const avgAttendanceRate = totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;
    const cancellationRate = (totalRegistered + totalCancelled) > 0
      ? Math.round((totalCancelled / (totalRegistered + totalCancelled)) * 100) : 0;
    const noShowRate = totalRegistered > 0 ? Math.round((totalNoShows / totalRegistered) * 100) : 0;

    const bestAttended = pastEventStats.length > 0
      ? [...pastEventStats].sort((a, b) => b.registered - a.registered)[0] : null;
    const highestAttendance = pastEventStats.length > 0
      ? [...pastEventStats].sort((a, b) => b.attendanceRate - a.attendanceRate)[0] : null;
    const highestCancellation = pastEventStats.length > 0
      ? [...pastEventStats].sort((a, b) => b.cancelled - a.cancelled)[0] : null;

    return {
      totalEvents, totalPast, avgParticipants, avgAttendanceRate,
      cancellationRate, noShowRate, totalRegistered, totalCheckedIn,
      totalCancelled, totalNoShows, pastEventStats,
      bestAttended, highestAttendance, highestCancellation,
    };
  }, [events, allRegistrations]);

  if (loading) return null;
  if (!user || !isOrganizer) return <Navigate to="/" replace />;

  return (
    <>
      <div className="px-4 pt-4 pb-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <Link to="/organizer/events/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Event
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="events" className="w-full">
          <TabsList className="w-full flex overflow-x-auto no-scrollbar">
            <TabsTrigger value="events" className="flex-1 min-w-0 text-xs px-2">Events</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 min-w-0 text-xs px-2">History</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 min-w-0 text-xs px-2">
              <BarChart3 className="h-3 w-3 mr-0.5 shrink-0" /> <span className="truncate">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex-1 min-w-0 text-xs px-2">
              <Lightbulb className="h-3 w-3 mr-0.5 shrink-0" /> <span className="truncate">Proposals</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="discounts" className="flex-1 min-w-0 text-xs px-2">
                  <Ticket className="h-3 w-3 mr-0.5 shrink-0" /> <span className="truncate">Discounts</span>
                </TabsTrigger>
                <TabsTrigger value="missions" className="flex-1 min-w-0 text-xs px-2">
                  <Target className="h-3 w-3 mr-0.5 shrink-0" /> <span className="truncate">Missions</span>
                </TabsTrigger>
                <TabsTrigger value="issues" className="flex-1 min-w-0 text-xs px-2">
                  <AlertTriangle className="h-3 w-3 mr-0.5 shrink-0" /> <span className="truncate">Issues</span>
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex-1 min-w-0 text-xs px-2">
                  <Copy className="h-3 w-3 mr-0.5 shrink-0" /> <span className="truncate">Templates</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-6 mt-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center">
                <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold font-display text-foreground">{events?.length || 0}</p>
                <p className="text-[11px] text-muted-foreground font-body">Total Events</p>
              </Card>
              <Card className="p-3 text-center">
                <Users className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold font-display text-foreground">
                  {events?.reduce((s, e) => s + e.spots_taken, 0) || 0}
                </p>
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
                        <Badge variant={event.status === "full" ? "destructive" : "secondary"} className="text-[10px]">
                          {event.spots_taken}/{event.spots_total}
                        </Badge>
                        <div className="flex gap-1 ml-1" onClick={(e) => e.preventDefault()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/event/${event.id}`);
                              toast({ title: "Link copiato!", description: "Puoi condividerlo con i partecipanti" });
                            }}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => navigate(`/organizer/events/new?duplicate=${event.id}`)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <h2 className="font-display text-lg font-bold text-foreground">Past Events</h2>
            {!analytics || analytics.pastEventStats.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground font-body text-sm">No past events yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {analytics.pastEventStats.map((evt) => (
                  <Link key={evt.id} to={`/organizer/events/${evt.id}`}>
                    <Card className="p-4 space-y-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-body font-semibold text-sm text-foreground truncate">{evt.title}</p>
                          <p className="text-xs text-muted-foreground font-body">
                            {format(new Date(evt.date), "dd MMM yyyy")} · {evt.category}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>

                      {/* KPIs row */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-sm font-bold font-display text-foreground">{evt.registered}/{evt.spotsTotal}</p>
                          <p className="text-[9px] text-muted-foreground font-body">Registered</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold font-display text-success">{evt.checkedIn}</p>
                          <p className="text-[9px] text-muted-foreground font-body">Attended</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold font-display text-destructive">{evt.noShows}</p>
                          <p className="text-[9px] text-muted-foreground font-body">No-shows</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold font-display text-warning">{evt.cancelled}</p>
                          <p className="text-[9px] text-muted-foreground font-body">Cancelled</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Progress value={evt.attendanceRate} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground font-body w-8 text-right">{evt.attendanceRate}%</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            {!analytics || analytics.totalPast === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground font-body text-sm">Analytics will be available after your first event completes</p>
              </Card>
            ) : (
              <>
                {/* Aggregate KPIs */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground font-body">Avg Participants</span>
                    </div>
                    <p className="text-xl font-bold font-display text-foreground">{analytics.avgParticipants}</p>
                    <p className="text-[10px] text-muted-foreground font-body">per event</p>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-xs text-muted-foreground font-body">Attendance Rate</span>
                    </div>
                    <p className="text-xl font-bold font-display text-foreground">{analytics.avgAttendanceRate}%</p>
                    <Progress value={analytics.avgAttendanceRate} className="h-1.5 mt-1" />
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-warning" />
                      <span className="text-xs text-muted-foreground font-body">Cancellation Rate</span>
                    </div>
                    <p className="text-xl font-bold font-display text-foreground">{analytics.cancellationRate}%</p>
                    <Progress value={analytics.cancellationRate} className="h-1.5 mt-1" />
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <UserX className="h-4 w-4 text-destructive" />
                      <span className="text-xs text-muted-foreground font-body">No-show Rate</span>
                    </div>
                    <p className="text-xl font-bold font-display text-foreground">{analytics.noShowRate}%</p>
                    <Progress value={analytics.noShowRate} className="h-1.5 mt-1" />
                  </Card>
                </div>

                {/* Insights */}
                <Card className="p-4 space-y-3">
                  <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> Key Insights
                  </h3>
                  {analytics.bestAttended && (
                    <div className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-body text-muted-foreground">Most attended event</p>
                        <p className="text-sm font-body font-semibold text-foreground">{analytics.bestAttended.title}</p>
                        <p className="text-[10px] text-muted-foreground font-body">{analytics.bestAttended.registered} participants</p>
                      </div>
                    </div>
                  )}
                  {analytics.highestAttendance && (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-body text-muted-foreground">Highest attendance rate</p>
                        <p className="text-sm font-body font-semibold text-foreground">{analytics.highestAttendance.title}</p>
                        <p className="text-[10px] text-muted-foreground font-body">{analytics.highestAttendance.attendanceRate}% attendance</p>
                      </div>
                    </div>
                  )}
                  {analytics.highestCancellation && analytics.highestCancellation.cancelled > 0 && (
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-body text-muted-foreground">Most cancellations</p>
                        <p className="text-sm font-body font-semibold text-foreground">{analytics.highestCancellation.title}</p>
                        <p className="text-[10px] text-muted-foreground font-body">{analytics.highestCancellation.cancelled} cancellations</p>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Participation Chart */}
                {analytics.pastEventStats.length > 1 && (
                  <Card className="p-4">
                    <h3 className="font-display text-sm font-bold text-foreground mb-3">Participation by Event</h3>
                    <ResponsiveContainer width="100%" height={Math.max(120, analytics.pastEventStats.length * 36)}>
                      <BarChart data={analytics.pastEventStats.slice(0, 10).map(e => ({
                        name: e.title.length > 15 ? e.title.slice(0, 15) + "…" : e.title,
                        registered: e.registered,
                        attended: e.checkedIn,
                      }))} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="registered" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Registered" />
                        <Bar dataKey="attended" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} name="Attended" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Attendance Rate Trend */}
                {analytics.pastEventStats.length > 1 && (
                  <Card className="p-4">
                    <h3 className="font-display text-sm font-bold text-foreground mb-3">Attendance Rate Trend</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={analytics.pastEventStats.map(e => ({
                        name: format(new Date(e.date), "dd MMM"),
                        rate: e.attendanceRate,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Attendance"]} />
                        <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Registration Status Distribution */}
                {(() => {
                  const statusData = [
                    { name: "Attended", value: analytics.totalCheckedIn, fill: "hsl(var(--success))" },
                    { name: "No-shows", value: analytics.totalNoShows, fill: "hsl(var(--destructive))" },
                    { name: "Cancelled", value: analytics.totalCancelled, fill: "hsl(var(--warning))" },
                  ].filter(d => d.value > 0);
                  if (statusData.length === 0) return null;
                  return (
                    <Card className="p-4">
                      <h3 className="font-display text-sm font-bold text-foreground mb-3">Overall Status Distribution</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                            {statusData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card>
                  );
                })()}

                {/* Registration Trend Area Chart */}
                {analytics.pastEventStats.length > 1 && (
                  <Card className="p-4">
                    <h3 className="font-display text-sm font-bold text-foreground mb-3">Registration Trend</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={analytics.pastEventStats.map(e => ({
                        name: format(new Date(e.date), "dd MMM"),
                        registered: e.registered,
                        cancelled: e.cancelled,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="registered" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" strokeWidth={2} name="Registered" />
                        <Area type="monotone" dataKey="cancelled" stroke="hsl(var(--warning))" fill="hsl(var(--warning)/0.2)" strokeWidth={2} name="Cancelled" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Proposals Tab */}
          <TabsContent value="proposals" className="mt-4">
            <ProposalsPanel />
          </TabsContent>

          {/* Discounts Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="discounts" className="mt-4">
              <DiscountCodesPanel />
            </TabsContent>
          )}

          {/* Missions Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="missions" className="mt-4">
              <MissionsPanel />
            </TabsContent>
          )}

          {/* Issues Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="issues" className="mt-4">
              <IssuesPanel />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="templates" className="mt-4">
              <BroadcastTemplatesPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
};

export default OrganizerDashboard;
