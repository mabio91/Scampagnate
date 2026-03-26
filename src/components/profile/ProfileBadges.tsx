import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Award, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { BadgeIcon } from "@/components/BadgeIcon";
import { Progress } from "@/components/ui/progress";
import EmptyState from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const PROGRESSION_BADGES = [
  { name: "Nuovo Arrivato", required: 1, description: "Partecipa al tuo primo evento" },
  { name: "Scampagnatore", required: 3, description: "Partecipa a 3 eventi" },
  { name: "Esploratore", required: 5, description: "Partecipa a 5 eventi" },
  { name: "Avventuriero", required: 10, description: "Partecipa a 10 eventi" },
  { name: "Veterano delle Scampagnate", required: 20, description: "Partecipa a 20 eventi" },
  { name: "Leggenda delle Scampagnate", required: 50, description: "Partecipa a 50 eventi" },
];

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  required_events: number;
  category: string | null;
}

interface UserBadgeData {
  id: string;
  badge_id: string;
  earned_at: string;
  badges: BadgeData;
}

const ProfileBadges = () => {
  const { user, profile } = useAuth();
  const [selectedBadge, setSelectedBadge] = useState<BadgeData | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: userBadges = [] } = useQuery({
    queryKey: ["user-badges", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", user.id);
      return (data || []) as unknown as UserBadgeData[];
    },
    enabled: !!user,
  });

  const { data: allBadges = [] } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("badges")
        .select("*")
        .order("required_events", { ascending: true });
      return (data || []) as BadgeData[];
    },
  });

  const attendedCount = profile?.total_points || 0;
  const earnedIds = new Set(userBadges.map((ub) => ub.badge_id));
  const earnedNames = new Set(userBadges.map((ub) => ub.badges?.name));

  const hasOfficialBadge = userBadges.some((ub) => ub.badges?.name === "Scampagnatore Ufficiale");
  const earnedRegular = userBadges.filter((ub) => ub.badges?.name !== "Scampagnatore Ufficiale");

  const nextBadges = PROGRESSION_BADGES
    .filter((b) => !earnedNames.has(b.name))
    .slice(0, 3)
    .map((pb) => {
      const dbBadge = allBadges.find((b) => b.name === pb.name);
      const progress = Math.min(attendedCount, pb.required);
      return { ...pb, icon: dbBadge?.icon || "💫", id: dbBadge?.id || pb.name, progress, dbBadge };
    });

  const allBadgesSorted = allBadges.filter((b) => b.name !== "Scampagnatore Ufficiale");

  const getBadgeProgress = (badge: BadgeData) => ({
    current: Math.min(attendedCount, badge.required_events),
    target: badge.required_events,
  });

  return (
    <div className="mb-6 animate-fade-in">
      <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        <Award className="h-5 w-5 text-secondary" /> Badge
      </h2>

      {/* Scampagnatore Ufficiale highlight */}
      {hasOfficialBadge && (
        <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3 transition-all duration-200 hover:shadow-sm">
          <BadgeIcon icon="🏅" className="h-7 w-7 text-primary" />
          <div>
            <p className="text-sm font-display font-bold text-primary">Scampagnatore Ufficiale</p>
            <p className="text-[10px] font-body text-muted-foreground">Membro ufficiale della community</p>
          </div>
        </div>
      )}

      {/* Section 1: I tuoi badge */}
      <div className="mb-4">
        <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2">I tuoi badge</h3>
        {earnedRegular.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
            {earnedRegular.map((ub, idx) => (
              <button
                key={ub.id}
                onClick={() => ub.badges && setSelectedBadge(ub.badges)}
                className="flex-shrink-0 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm active:scale-[0.95] transition-all duration-200 text-center min-w-[100px]"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <BadgeIcon icon={ub.badges?.icon || ""} className="h-7 w-7 mx-auto text-primary" />
                <p className="text-xs font-body font-semibold text-foreground mt-1.5 leading-tight">
                  {ub.badges?.name}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Award}
            title="Nessun badge ottenuto"
            description="Partecipa al tuo primo evento per iniziare a guadagnare badge e mostrare i tuoi traguardi"
            ctaLabel="Scopri eventi"
            ctaTo="/"
            compact
          />
        )}
      </div>

      {/* Section 2: Prossimi badge */}
      {nextBadges.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2">Prossimi badge</h3>
          <div className="space-y-2">
            {nextBadges.map((badge) => (
              <button
                key={badge.id}
                onClick={() => badge.dbBadge && setSelectedBadge(badge.dbBadge)}
                className="w-full p-3 rounded-xl bg-muted/50 border border-border hover:border-primary/20 hover:shadow-sm active:scale-[0.98] transition-all duration-200 flex items-center gap-3 text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <BadgeIcon icon={badge.icon} className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground">{badge.name}</p>
                  <p className="text-[11px] font-body text-muted-foreground">{badge.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Progress value={(badge.progress / badge.required) * 100} className="h-1.5 flex-1" />
                    <span className="text-[10px] font-display text-muted-foreground font-bold whitespace-nowrap">
                      {badge.progress}/{badge.required}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Tutti i badge */}
      <div>
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-2 text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2 hover:text-primary transition-colors active:scale-[0.97]"
        >
          Tutti i badge
          {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAll && (
          <div className="grid grid-cols-2 gap-2 animate-fade-in">
            {allBadgesSorted.map((badge) => {
              const isEarned = earnedIds.has(badge.id);
              const { current, target } = getBadgeProgress(badge);
              return (
                <button
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className={`p-3 rounded-xl text-center transition-all duration-200 active:scale-[0.95] ${
                    isEarned
                      ? "bg-card border border-primary/20 hover:border-primary/40 hover:shadow-sm"
                      : "bg-muted/30 border border-border hover:border-muted-foreground/20"
                  }`}
                >
                  <div className="relative inline-block">
                    <BadgeIcon
                      icon={badge.icon}
                      className={`h-6 w-6 mx-auto ${isEarned ? "text-primary" : "text-muted-foreground/30"}`}
                    />
                    {!isEarned && (
                      <Lock className="h-3 w-3 absolute -bottom-0.5 -right-0.5 text-muted-foreground/50" />
                    )}
                  </div>
                  <p className={`text-xs font-body font-semibold mt-1.5 leading-tight ${
                    isEarned ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {badge.name}
                  </p>
                  {!isEarned && (
                    <p className="text-[10px] font-body text-muted-foreground mt-0.5">
                      {current}/{target} eventi
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Badge Detail Modal */}
      <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center text-center">
            {selectedBadge && (
              <>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                  earnedIds.has(selectedBadge.id) ? "bg-primary/10" : "bg-muted"
                }`}>
                  <BadgeIcon
                    icon={selectedBadge.icon}
                    className={`h-8 w-8 ${earnedIds.has(selectedBadge.id) ? "text-primary" : "text-muted-foreground/40"}`}
                  />
                </div>
                <DialogTitle className="font-display">{selectedBadge.name}</DialogTitle>
                <DialogDescription className="text-sm font-body">
                  {selectedBadge.description}
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {selectedBadge && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/50">
                <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Come ottenerlo
                </p>
                <p className="text-sm font-body text-foreground">
                  Partecipa a {selectedBadge.required_events} {selectedBadge.required_events === 1 ? "evento" : "eventi"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/50">
                <p className="text-xs font-body font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Progresso
                </p>
                <div className="flex items-center gap-3">
                  <Progress
                    value={Math.min(100, (attendedCount / selectedBadge.required_events) * 100)}
                    className="h-2 flex-1"
                  />
                  <span className="text-sm font-display font-bold text-foreground">
                    {Math.min(attendedCount, selectedBadge.required_events)}/{selectedBadge.required_events}
                  </span>
                </div>
              </div>

              {earnedIds.has(selectedBadge.id) ? (
                <div className="text-center p-2 rounded-lg bg-primary/10">
                  <p className="text-sm font-body font-bold text-primary flex items-center justify-center gap-1.5">
                    <CheckCircle className="h-4 w-4" /> Badge ottenuto!
                  </p>
                  {userBadges.find((ub) => ub.badge_id === selectedBadge.id)?.earned_at && (
                    <p className="text-[10px] font-body text-muted-foreground mt-0.5">
                      Ottenuto il{" "}
                      {new Date(
                        userBadges.find((ub) => ub.badge_id === selectedBadge.id)!.earned_at
                      ).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-sm font-body text-muted-foreground flex items-center justify-center gap-1.5">
                    <Lock className="h-4 w-4" /> Mancano {selectedBadge.required_events - Math.min(attendedCount, selectedBadge.required_events)} eventi
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Need CheckCircle for the modal
import { CheckCircle } from "lucide-react";

export default ProfileBadges;
