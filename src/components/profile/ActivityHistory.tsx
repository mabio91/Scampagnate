import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import EmptyState from "@/components/EmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Activity, CalendarCheck, CalendarX, AlertCircle, CheckCircle2,
  Flame, Clock, TrendingUp, ChevronDown, ChevronUp, BarChart3, Shield,
  ChevronRight, X
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

const TIMELINE_PAGE_SIZE = 8;

const StatCard = ({ icon: Icon, value, label, iconColor }: {
  icon: typeof CalendarCheck; value: number; label: string; iconColor: string;
}) => (
  <div className="p-3 rounded-xl bg-card border border-border flex flex-col items-center text-center transition-all duration-200 hover:shadow-sm hover:border-primary/15 active:scale-[0.97]">
    <Icon className={`h-5 w-5 ${iconColor} mb-1`} />
    <span className="text-xl font-display font-bold text-foreground">{value}</span>
    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</span>
  </div>
);

export const ActivityHistory = () => {
  const { user } = useAuth();
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineLimit, setTimelineLimit] = useState(TIMELINE_PAGE_SIZE);
  const [showStreakDetails, setShowStreakDetails] = useState(false);
  const isMobile = useIsMobile();

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

  const metrics = useMemo(() => {
    if (!data || data.length === 0) return null;
    const now = new Date();
    let attended = 0, cancelled = 0, noShows = 0, joined = 0;
    const categoryMap: Record<string, number> = {};
    const attendedDates: Date[] = [];

    data.forEach((reg) => {
      const eventDate = reg.events?.date ? new Date(reg.events.date) : null;
      const isPast = eventDate ? eventDate < now : false;
      if (reg.status === "registered" || reg.status === "paid") joined++;
      if (reg.checked_in) {
        attended++;
        if (eventDate) attendedDates.push(eventDate);
        const catName = reg.events?.event_categories?.name;
        if (catName) categoryMap[catName] = (categoryMap[catName] || 0) + 1;
      }
      if (reg.status === "cancelled") cancelled++;
      if ((reg.status === "registered" || reg.status === "paid") && isPast && !reg.checked_in) noShows++;
    });

    // Streak
    const pastRegs = data
      .filter(r => r.events?.date && new Date(r.events.date) < now && (r.status === "registered" || r.status === "paid" || r.checked_in))
      .sort((a, b) => new Date(b.events!.date).getTime() - new Date(a.events!.date).getTime());
    const streakEvents: RegistrationWithEvent[] = [];
    let streak = 0;
    for (const reg of pastRegs) {
      if (!reg.checked_in) break;
      streak++;
      streakEvents.push(reg);
    }

    const lastAttended = data
      .filter(r => r.checked_in && r.events)
      .sort((a, b) => new Date(b.events!.date).getTime() - new Date(a.events!.date).getTime())[0];

    const totalPastWithSpot = attended + noShows;
    const reliability = totalPastWithSpot > 0 ? Math.round((attended / totalPastWithSpot) * 100) : 100;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const frequency = (attendedDates.filter(d => d >= sixMonthsAgo).length / 6).toFixed(1);

    const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];
    const topCategoryPct = topCategory && attended > 0 ? Math.round((topCategory[1] / attended) * 100) : 0;
    const topCategoryIcon = topCategory
      ? data.find(r => r.events?.event_categories?.name === topCategory[0])?.events?.event_categories?.icon
      : undefined;

    const allTimeline = data
      .filter(r => r.events?.date && new Date(r.events.date) < now)
      .sort((a, b) => new Date(b.events!.date).getTime() - new Date(a.events!.date).getTime());

    return { attended, cancelled, noShows, joined, streak, streakEvents, lastAttended, reliability, frequency, topCategory, topCategoryPct, topCategoryIcon, allTimeline };
  }, [data]);

  const getStatusLabel = useCallback((reg: RegistrationWithEvent) => {
    const now = new Date();
    if (reg.checked_in) return { label: "Partecipato", color: "text-success", Icon: CheckCircle2 };
    if (reg.status === "cancelled") return { label: "Cancellato", color: "text-destructive", Icon: CalendarX };
    if (reg.status === "no_show") return { label: "No-show", color: "text-destructive", Icon: AlertCircle };
    const isPast = reg.events?.date ? new Date(reg.events.date) < now : false;
    if (isPast && !reg.checked_in) return { label: "Non presentato", color: "text-warning", Icon: AlertCircle };
    return { label: "Iscritto", color: "text-primary", Icon: CalendarCheck };
  }, []);

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

  if (!data || data.length === 0 || !metrics) {
    return (
      <div className="mb-6 animate-fade-in">
        <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-secondary" /> Cronologia Attività
        </h2>
        <EmptyState
          icon={CalendarCheck}
          title="Nessuna attività ancora registrata"
          description="Partecipa al tuo primo evento per iniziare a costruire la tua cronologia e sbloccare le statistiche"
          ctaLabel="Esplora eventi"
          ctaTo="/"
        />
      </div>
    );
  }

  const { attended, cancelled, noShows, joined, streak, streakEvents, lastAttended, reliability, frequency, topCategory, topCategoryPct, topCategoryIcon, allTimeline } = metrics;
  const visibleTimeline = allTimeline.slice(0, timelineLimit);
  const hasMoreTimeline = allTimeline.length > timelineLimit;

  const StreakDetailsContent = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-body font-bold uppercase tracking-[0.24em] text-muted-foreground">
          Streak attuale
        </p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${streak > 0 ? "bg-orange-500/10" : "bg-muted"}`}>
              <Flame className={`h-6 w-6 ${streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-3xl font-display font-bold leading-none text-foreground">{streak}</p>
              <p className="mt-1 text-sm font-body text-muted-foreground">{streak === 1 ? "evento consecutivo" : "eventi consecutivi"}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-display font-bold uppercase tracking-[0.24em] text-muted-foreground">
          Eventi che contano per la streak
        </h4>
        {streakEvents.length > 0 ? (
          <div className="mt-3 space-y-2">
            {streakEvents.map((reg) => (
              <Link
                key={reg.id}
                to={`/event/${reg.events!.id}`}
                onClick={() => setShowStreakDetails(false)}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-all duration-200 hover:border-primary/20 hover:shadow-sm active:scale-[0.99]"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-base">
                  {reg.events?.event_categories?.icon || "🗓️"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-body font-semibold text-foreground">{reg.events!.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-body text-muted-foreground">
                    <span>
                      {new Date(reg.events!.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Check-in confermato
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-border bg-card/60 p-4 text-sm font-body text-muted-foreground">
            Nessun evento nella streak attuale.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mb-6 animate-fade-in">
      <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        <Activity className="h-5 w-5 text-secondary" /> Cronologia Attività
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard icon={CalendarCheck} value={joined} label="Iscritti" iconColor="text-primary" />
        <StatCard icon={CheckCircle2} value={attended} label="Completati" iconColor="text-success" />
        <StatCard icon={AlertCircle} value={noShows} label="No-show" iconColor="text-destructive" />
        <StatCard icon={CalendarX} value={cancelled} label="Cancellati" iconColor="text-destructive" />
      </div>

      {/* Streak */}
      <button
        type="button"
        onClick={() => setShowStreakDetails(true)}
        className="mb-4 w-full rounded-2xl border border-border bg-card p-4 text-left transition-all duration-200 hover:border-primary/20 hover:shadow-sm active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${streak > 0 ? "bg-orange-500/10" : "bg-muted"}`}>
              <Flame className={`h-5 w-5 ${streak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
            </div>
            <span className="text-[11px] font-body font-bold uppercase tracking-[0.24em] text-muted-foreground">
              Streak attuale
            </span>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />
        </div>

        <div className="mt-4">
          <p className="text-4xl font-display font-bold leading-none text-foreground">
            {streak}
          </p>
          <p className="mt-2 text-sm font-body text-muted-foreground">
            {streak === 1 ? "evento consecutivo completato" : "eventi consecutivi completati"}
          </p>
        </div>

        {lastAttended?.events && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-background/30 p-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-base">
              {lastAttended.events.event_categories?.icon || <Clock className="h-5 w-5 text-secondary" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-body font-semibold text-foreground">
                {lastAttended.events.title}
              </p>
              <p className="mt-1 text-[11px] font-body text-muted-foreground">
                {new Date(lastAttended.events.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
        )}
      </button>

      {/* Performance Insights */}
      <div className="mb-4">
        <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" /> Statistiche
        </h3>
        <div className="space-y-3 p-3 rounded-xl bg-card border border-border">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-xs font-body font-semibold text-foreground">Affidabilità</span>
              </div>
              <span className={`text-xs font-display font-bold ${
                reliability >= 80 ? "text-success" : reliability >= 50 ? "text-warning" : "text-destructive"
              }`}>{reliability}%</span>
            </div>
            <Progress value={reliability} className="h-1.5" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-body font-semibold text-foreground">Frequenza attività</span>
            </div>
            <span className="text-xs font-display font-bold text-foreground">{frequency} eventi/mese</span>
          </div>
          {topCategory && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{topCategoryIcon || "🏔"}</span>
                <span className="text-xs font-body font-semibold text-foreground">Categoria preferita</span>
              </div>
              <span className="text-xs font-display font-bold text-foreground">{topCategory[0]} {topCategoryPct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Toggle */}
      <button
        onClick={() => {
          setShowTimeline(!showTimeline);
          setTimelineLimit(TIMELINE_PAGE_SIZE);
        }}
        className="flex items-center gap-2 text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2 hover:text-primary transition-colors active:scale-[0.97]"
      >
        <Clock className="h-3.5 w-3.5" /> Timeline
        {showTimeline ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showTimeline && (
        <div className="relative pl-6 border-l-2 border-border space-y-0 animate-fade-in">
          {visibleTimeline.length > 0 ? (
            <>
              {visibleTimeline.map((reg, idx) => {
                const status = getStatusLabel(reg);
                const StatusIcon = status.Icon;
                return (
                  <Link
                    key={reg.id}
                    to={`/event/${reg.events!.id}`}
                    className="block relative py-3 hover:bg-muted/30 rounded-r-xl px-3 -ml-3 transition-all duration-200 active:scale-[0.99] group"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className={`absolute left-[-19px] top-4 w-3 h-3 rounded-full border-2 border-background transition-transform duration-200 group-hover:scale-125 ${
                      reg.checked_in ? "bg-success" : reg.status === "cancelled" ? "bg-destructive" : "bg-warning"
                    }`} />
                    <p className="text-sm font-body font-semibold text-foreground group-hover:text-primary transition-colors">{reg.events!.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] font-body text-muted-foreground">
                        {new Date(reg.events!.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      {reg.events!.event_categories && (
                        <span className="text-[10px] font-body text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted">
                          {reg.events!.event_categories.name}
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] font-body font-semibold mt-0.5 ${status.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </div>
                  </Link>
                );
              })}
              {hasMoreTimeline && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setTimelineLimit(prev => prev + TIMELINE_PAGE_SIZE);
                  }}
                  className="w-full py-2 text-xs font-body font-semibold text-primary hover:text-primary/80 transition-colors active:scale-[0.97]"
                >
                  Mostra altri ({allTimeline.length - timelineLimit} rimanenti)
                </button>
              )}
            </>
          ) : (
            <EmptyState
              icon={CalendarCheck}
              title="Non hai ancora partecipato a eventi"
              description="Scopri le prossime esperienze disponibili"
              ctaLabel="Esplora eventi"
              ctaTo="/"
              compact
            />
          )}
        </div>
      )}

      {isMobile ? (
        <Drawer open={showStreakDetails} onOpenChange={setShowStreakDetails}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="flex items-center justify-between pb-2">
              <div>
                <DrawerTitle className="font-display text-base">Dettaglio streak</DrawerTitle>
                <DrawerDescription className="font-body text-sm">
                  I tuoi eventi consecutivi completati piu recenti.
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button className="rounded-full p-1 hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </DrawerClose>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <StreakDetailsContent />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showStreakDetails} onOpenChange={setShowStreakDetails}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-base">Dettaglio streak</DialogTitle>
              <DialogDescription className="font-body text-sm">
                I tuoi eventi consecutivi completati piu recenti.
              </DialogDescription>
            </DialogHeader>
            <StreakDetailsContent />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
