import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { format, parseISO, eachDayOfInterval, startOfDay, subDays } from "date-fns";
import { Users, CheckCircle2, UserX, TrendingUp } from "lucide-react";

interface Registration {
  id: string;
  created_at: string;
  status: string;
  checked_in: boolean;
  meeting_point_id: string | null;
  profiles: any;
}

interface MeetingPoint {
  id: string;
  name: string;
}

interface EventAnalyticsProps {
  event: {
    date: string;
    spots_total: number;
    spots_taken: number;
    created_at: string;
  };
  registrations: Registration[];
  meetingPoints: MeetingPoint[];
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

const EventAnalytics = ({ event, registrations, meetingPoints }: EventAnalyticsProps) => {
  const registered = registrations.filter((r) => r.status === "registered" || r.status === "paid");
  const checkedIn = registered.filter((r) => r.checked_in);
  const noShows = registered.filter((r) => !r.checked_in && new Date(event.date) < new Date());
  const cancelled = registrations.filter((r) => r.status === "cancelled");
  const isPast = new Date(event.date) < new Date();

  const attendanceRate = registered.length > 0 ? Math.round((checkedIn.length / registered.length) * 100) : 0;
  const noShowRate = registered.length > 0 ? Math.round((noShows.length / registered.length) * 100) : 0;
  const fillRate = Math.round((event.spots_taken / event.spots_total) * 100);

  // Registration trend (cumulative registrations over time)
  const trendData = useMemo(() => {
    if (registrations.length === 0) return [];
    const validRegs = registrations
      .filter((r) => r.status !== "cancelled")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (validRegs.length === 0) return [];

    const firstDate = startOfDay(parseISO(validRegs[0].created_at));
    const lastDate = startOfDay(new Date(event.date) < new Date() ? new Date(event.date) : new Date());
    const days = eachDayOfInterval({ start: firstDate, end: lastDate });

    let cumulative = 0;
    return days.map((day) => {
      const dayRegs = validRegs.filter(
        (r) => startOfDay(parseISO(r.created_at)).getTime() === day.getTime()
      );
      cumulative += dayRegs.length;
      return {
        date: format(day, "dd/MM"),
        registrations: cumulative,
        daily: dayRegs.length,
      };
    });
  }, [registrations, event.date]);

  // Attendance pie chart data
  const attendanceData = useMemo(() => {
    if (!isPast) return [];
    return [
      { name: "Checked In", value: checkedIn.length },
      { name: "No-Show", value: noShows.length },
    ].filter((d) => d.value > 0);
  }, [checkedIn, noShows, isPast]);

  // Meeting point distribution
  const mpDistribution = useMemo(() => {
    if (!meetingPoints.length) return [];
    return meetingPoints.map((mp) => ({
      name: mp.name.length > 12 ? mp.name.slice(0, 12) + "…" : mp.name,
      count: registered.filter((r) => r.meeting_point_id === mp.id).length,
    }));
  }, [meetingPoints, registered]);

  // Status breakdown
  const statusData = useMemo(() => [
    { name: "Active", value: registered.length },
    { name: "Waitlist", value: registrations.filter((r) => r.status === "waitlist").length },
    { name: "Cancelled", value: cancelled.length },
  ].filter((d) => d.value > 0), [registered, registrations, cancelled]);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground font-body">Fill Rate</span>
          </div>
          <p className="text-xl font-bold font-display text-foreground">{fillRate}%</p>
          <Progress value={fillRate} className="h-1.5 mt-1" />
          <p className="text-[10px] text-muted-foreground font-body mt-1">
            {event.spots_taken}/{event.spots_total} spots
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-secondary" />
            <span className="text-xs text-muted-foreground font-body">Total Signups</span>
          </div>
          <p className="text-xl font-bold font-display text-foreground">{registrations.length}</p>
          <p className="text-[10px] text-muted-foreground font-body mt-1">
            {cancelled.length} cancelled
          </p>
        </Card>

        {isPast && (
          <>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-xs text-muted-foreground font-body">Attendance</span>
              </div>
              <p className="text-xl font-bold font-display text-foreground">{attendanceRate}%</p>
              <Progress value={attendanceRate} className="h-1.5 mt-1" />
              <p className="text-[10px] text-muted-foreground font-body mt-1">
                {checkedIn.length} checked in
              </p>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <UserX className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground font-body">No-Shows</span>
              </div>
              <p className="text-xl font-bold font-display text-foreground">{noShowRate}%</p>
              <Progress value={noShowRate} className="h-1.5 mt-1" />
              <p className="text-[10px] text-muted-foreground font-body mt-1">
                {noShows.length} absent
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Registration Trend */}
      {trendData.length > 1 && (
        <Card className="p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3">Registration Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="registrations"
                stroke="hsl(var(--primary))"
                fill="url(#regGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Attendance Breakdown (Past events) */}
      {isPast && attendanceData.length > 0 && (
        <Card className="p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3">Attendance Breakdown</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={4}
                  dataKey="value"
                >
                  <Cell fill="hsl(var(--success))" />
                  <Cell fill="hsl(var(--destructive))" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {attendanceData.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: i === 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }}
                  />
                  <span className="text-xs font-body text-foreground">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Status Breakdown */}
      {statusData.length > 1 && (
        <Card className="p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={statusData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={65} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Meeting Point Distribution */}
      {mpDistribution.length > 0 && (
        <Card className="p-4">
          <h3 className="font-display text-sm font-bold text-foreground mb-3">By Meeting Point</h3>
          <ResponsiveContainer width="100%" height={Math.max(80, mpDistribution.length * 36)}>
            <BarChart data={mpDistribution} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {registrations.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground font-body">No registration data yet</p>
        </Card>
      )}
    </div>
  );
};

export default EventAnalytics;
