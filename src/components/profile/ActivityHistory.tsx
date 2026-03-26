import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import {
  Activity, CalendarCheck, CalendarX, AlertCircle, CheckCircle2,
  Flame, Clock, TrendingUp, ChevronDown, ChevronUp, BarChart3, Shield
} from "lucide-react";

interface RegistrationWithEvent {
  id: string;
  status: string;
  checked_in: boolean;
  created_at: string;
  events: {
    id: string;
    title: string;
    date: string;
    time: string;
    event_categories: { name: string; icon: string } | null;
  } | null;
}

export const ActivityHistory = () => {
  const { user } = useAuth();
  const [showTimeline, setShowTimeline] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["user-activity-full", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: regs, error } = await supabase
        .from("event_registrations")
        .select("id, status, checked_in, created_at, events(id, title, date, time, event_categories(name, icon))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (regs || []) as unknown as RegistrationWithEvent[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-6 w-40 bg-muted rounded mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted/50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const now = new Date();

  // Compute metrics
  let attended = 0;
  let cancelled = 0;
  let noShows = 0;
  let joined = 0;
  const categoryMap: Record<string, number> = {};
  const attendedDates: Date[] = [];

  data.forEach((reg) => {
    const eventDate = reg.events?.date ? new Date(reg.events.date) : null;
    const isPast = eventDate ? eventDate < now : false;

    if (reg.status === "registered" || reg.status === "paid") {
      joined++;
    }
    if (reg.checked_in) {
      attended++;
      if (eventDate) attendedDates.push(eventDate);
      const catName = reg.events?.event_categories?.name;
      if (catName) categoryMap[catName] = (categoryMap[catName] || 0) + 1;
    }
    if (reg.status === "cancelled") cancelled++;
    if ((reg.status === "registered" || reg.status === "paid") && isPast && !reg.checked_in) {
      noShows++;
    }
  });

  // Streak: consecutive attended events (sorted by date desc)
  const sortedAttended = [...attendedDates].sort((a, b) => b.getTime() - a.getTime());
  let streak = 0;
  // Count how many recent past events (in order) were attended
  const pastRegs = data
    .filter(r => r.events?.date && new Date(r.events.date) < now && (r.status === "registered" || r.status === "paid" || r.checked_in))
    .sort((a, b) => new Date(b.events!.date).getTime() - new Date(a.events!.date).getTime());

  for (const reg of pastRegs) {
    if (reg.checked_in) {
      streak++;
    } else {
      break;
    }
  }

  // Last attended event
  const lastAttended = data
    .filter(r => r.checked_in && r.events)
    .sort((a, b) => new Date(b.events!.date).getTime() - new Date(a.events!.date).getTime())[0];

  // Reliability
  const totalPastWithSpot = attended + noShows;
  const reliability = totalPastWithSpot > 0 ? Math.round((attended / totalPastWithSpot) * 100) : 100;

  // Frequency: events per month over last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentAttended = attendedDates.filter(d => d >= sixMonthsAgo).length;
  const frequency = (recentAttended / 6).toFixed(1);

  // Top category
  const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];
  const topCategoryPct = topCategory && attended > 0 ? Math.round((topCategory[1] / attended) * 100) : 0;

  // Timeline items (past events)
  const timelineItems = data
    .filter(r => r.events?.date && new Date(r.events.date) < now)
    .sort((a, b) => new Date(b.events!.date).getTime() - new Date(a.events!.date).getTime())
    .slice(0, showTimeline ? 20 : 0);

  const getStatusLabel = (reg: RegistrationWithEvent) => {
    if (reg.checked_in) return { label: "Partecipato", color: "text-success", icon: "✔️" };
    if (reg.status === "cancelled") return { label: "Cancellato", color: "text-destructive", icon: "✖️" };
    if (reg.status === "no_show") return { label: "No-show", color: "text-destructive", icon: "⚠️" };
    const isPast = reg.events?.date ? new Date(reg.events.date) < now : false;
    if (isPast && !reg.checked_in) return { label: "Non presentato", color: "text-warning", icon: "⚠️" };
    return { label: "Iscritto", color: "text-primary", icon: "📋" };
  };

  return (
    <div className="mb-6">
      <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        <Activity className="h-5 w-5 text-secondary" /> Cronologia Attività
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center text-center">
          <CalendarCheck className="h-5 w-5 text-primary mb-1" />
          <span className="text-xl font-display font-bold text-foreground">{joined}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Eventi iscritti</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center text-center">
          <CheckCircle2 className="h-5 w-5 text-success mb-1" />
          <span className="text-xl font-display font-bold text-foreground">{attended}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Completati</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center text-center">
          <AlertCircle className="h-5 w-5 text-destructive mb-1" />
          <span className="text-xl font-display font-bold text-foreground">{noShows}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">No-show</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center text-center">
          <CalendarX className="h-5 w-5 text-destructive mb-1" />
          <span className="text-xl font-display font-bold text-foreground">{cancelled}</span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cancellazioni</span>
        </div>
      </div>

      {/* Streak + Last Event */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 p-3 rounded-xl bg-card border border-border flex items-center gap-3">
          <Flame className={`h-5 w-5 flex-shrink-0 ${streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          <div>
            <p className="text-sm font-display font-bold text-foreground">{streak} {streak === 1 ? "evento" : "eventi"}</p>
            <p className="text-[10px] text-muted-foreground font-body uppercase font-bold tracking-wider">Streak attuale</p>
          </div>
        </div>
        {lastAttended?.events && (
          <Link to={`/event/${lastAttended.events.id}`} className="flex-1 p-3 rounded-xl bg-card border border-border flex items-center gap-3 hover:border-primary/20 transition-colors">
            <Clock className="h-5 w-5 text-secondary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-body font-semibold text-foreground truncate">{lastAttended.events.title}</p>
              <p className="text-[10px] text-muted-foreground font-body">
                {new Date(lastAttended.events.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Performance Insights */}
      <div className="mb-4">
        <h3 className="text-sm font-display font-bold text-foreground mb-2 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-secondary" /> Statistiche
        </h3>
        <div className="space-y-3 p-3 rounded-xl bg-card border border-border">
          {/* Reliability */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-xs font-body font-semibold text-foreground">Affidabilità</span>
              </div>
              <span className={`text-xs font-body font-bold ${
                reliability >= 80 ? "text-success" : reliability >= 50 ? "text-warning" : "text-destructive"
              }`}>{reliability}%</span>
            </div>
            <Progress value={reliability} className="h-1.5" />
          </div>

          {/* Frequency */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-body font-semibold text-foreground">Frequenza attività</span>
            </div>
            <span className="text-xs font-body font-bold text-foreground">{frequency} eventi/mese</span>
          </div>

          {/* Top Category */}
          {topCategory && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{
                  data.find(r => r.events?.event_categories?.name === topCategory[0])?.events?.event_categories?.icon || "🏔"
                }</span>
                <span className="text-xs font-body font-semibold text-foreground">Categoria preferita</span>
              </div>
              <span className="text-xs font-body font-bold text-foreground">{topCategory[0]} {topCategoryPct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Toggle */}
      <button
        onClick={() => setShowTimeline(!showTimeline)}
        className="flex items-center gap-2 text-sm font-display font-bold text-foreground mb-2 hover:text-primary transition-colors"
      >
        <Clock className="h-4 w-4" /> Timeline
        {showTimeline ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showTimeline && (
        <div className="relative pl-6 border-l-2 border-border space-y-0">
          {timelineItems.length > 0 ? (
            timelineItems.map((reg) => {
              const status = getStatusLabel(reg);
              return (
                <Link
                  key={reg.id}
                  to={`/event/${reg.events!.id}`}
                  className="block relative py-3 hover:bg-muted/30 rounded-r-xl px-3 -ml-3 transition-colors"
                >
                  {/* Dot */}
                  <div className={`absolute left-[-19px] top-4 w-3 h-3 rounded-full border-2 border-background ${
                    reg.checked_in ? "bg-success" : reg.status === "cancelled" ? "bg-destructive" : "bg-warning"
                  }`} />
                  
                  <p className="text-sm font-body font-semibold text-foreground">{reg.events!.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] font-body text-muted-foreground">
                      {new Date(reg.events!.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    {reg.events!.event_categories && (
                      <span className="text-[10px] font-body text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        {reg.events!.event_categories.name}
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] font-body font-semibold mt-0.5 ${status.color}`}>
                    {status.icon} {status.label}
                  </p>
                </Link>
              );
            })
          ) : (
            <p className="text-sm font-body text-muted-foreground py-3 pl-3">Nessun evento passato</p>
          )}
        </div>
      )}
    </div>
  );
};
