import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMissions, useActiveMissions } from "@/hooks/useMissions";
import { useSearch } from "@/contexts/SearchContext";
import { Progress } from "@/components/ui/progress";
import { Target, Gift, CheckCircle, ChevronRight, Clock, Ticket, Trophy, Beer } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import DynamicIcon from "@/components/DynamicIcon";

const TYPE_LABELS: Record<string, string> = {
  one_time: "Una tantum",
  weekly: "Settimanale",
  monthly: "Mensile",
  progressive: "Progressiva",
  streak: "Streak",
  category: "Per categoria",
};

const REWARD_ICONS: Record<string, typeof Gift> = {
  coupon: Ticket,
  badge: Trophy,
  physical: Beer,
};

const getFilterForMission = (mission: any): { category?: string; quickFilter?: string } => {
  if (mission.category) return { category: mission.category };
  if (mission.target_action === "limited_spots") return { quickFilter: "lastSpots" };
  if (mission.type === "weekly") return { quickFilter: "thisWeek" };
  return {};
};

const ProfileMissions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setSelectedCategory, toggleQuickFilter, clearAllFilters } = useSearch();
  const { data: userMissions = [] } = useUserMissions(user?.id);
  const { data: activeMissions = [] } = useActiveMissions();
  const userMissionMap = new Map(userMissions.map((mission) => [mission.mission_id, mission]));

  const missionsToShow = activeMissions.length > 0
    ? activeMissions.map((mission) => {
        const userMission = userMissionMap.get(mission.id);

        return {
          id: mission.id,
          title: mission.title,
          description: mission.description,
          progress: userMission?.progress ?? 0,
          target: mission.target_value,
          rewardPoints: mission.reward_points,
          completed: userMission?.completed ?? false,
          type: mission.type,
          icon: (mission as any).icon || "lucide:Target",
          reward_type: (mission as any).reward_type || "points",
          reward_value: (mission as any).reward_value || null,
          category: mission.category || null,
          target_action: (mission as any)?.target_action || "event_attended",
          expires_at: (mission as any)?.expires_at || null,
        };
      })
    : userMissions.map((mission) => ({
        id: mission.mission_id,
        title: mission.missions?.title || "",
        description: mission.missions?.description || "",
        progress: mission.progress,
        target: mission.missions?.target_value || 1,
        rewardPoints: mission.missions?.reward_points || 0,
        completed: mission.completed,
        type: mission.missions?.type || "one_time",
        icon: (mission.missions as any)?.icon || "lucide:Target",
        reward_type: (mission.missions as any)?.reward_type || "points",
        reward_value: (mission.missions as any)?.reward_value || null,
        category: (mission.missions as any)?.category || null,
        target_action: (mission.missions as any)?.target_action || "event_attended",
        expires_at: (mission.missions as any)?.expires_at || null,
      }));

  const handleMissionClick = (mission: any) => {
    clearAllFilters();
    const filter = getFilterForMission(mission);
    if (filter.category) {
      setSelectedCategory(filter.category);
    }
    if (filter.quickFilter) {
      toggleQuickFilter(filter.quickFilter as any);
    }
    navigate("/");
  };

  const getCountdown = (expiresAt: string | null): string | null => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Scaduta";
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 1) return "Scade domani";
    return `${days} giorni rimasti`;
  };

  return (
    <div className="mb-6 animate-fade-in">
      <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-secondary" /> Missioni
      </h2>

      {missionsToShow.length > 0 ? (
        <div className="space-y-2">
          {missionsToShow.map((mission) => {
            const hasReward = mission.reward_type !== "points";
            const RewardIcon = REWARD_ICONS[mission.reward_type];
            const countdown = getCountdown(mission.expires_at);
            const isUrgent = countdown && !countdown.includes("Scaduta") && parseInt(countdown) <= 3;

            return (
              <button
                key={mission.id}
                onClick={() => handleMissionClick(mission)}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group ${
                  mission.completed
                    ? "bg-primary/5 border-primary/20"
                    : hasReward
                    ? "bg-card border-primary/10 hover:border-primary/30"
                    : "bg-card border-border hover:border-primary/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                    mission.completed ? "bg-primary/10" : "bg-muted"
                  }`}>
                    {mission.completed ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <DynamicIcon value={mission.icon} size={16} className="text-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-body font-semibold text-foreground">{mission.title}</p>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-[11px] font-body text-muted-foreground">{mission.description}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <Progress
                        value={(Math.min(mission.progress, mission.target) / mission.target) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-[10px] font-display text-muted-foreground font-bold whitespace-nowrap">
                        {Math.min(mission.progress, mission.target)} di {mission.target}
                      </span>
                    </div>

                    {mission.completed && (
                      <p className="text-[10px] font-body text-primary mt-1 flex items-center gap-1 font-semibold">
                        <CheckCircle className="h-3 w-3" />
                        Completata
                      </p>
                    )}

                    {!mission.completed && hasReward && (
                      <p className="text-[10px] font-body text-primary mt-1 flex items-center gap-1">
                        {RewardIcon && <RewardIcon className="h-3 w-3" />}
                        {mission.reward_type === "coupon"
                          ? "Sblocca uno sconto"
                          : mission.reward_type === "badge"
                            ? "Sblocca un badge"
                            : "Premio al completamento"}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Gift className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-body font-semibold text-primary">
                          +{mission.rewardPoints} punti
                        </span>
                      </div>
                      {mission.type !== "one_time" && (
                        <span className="text-[10px] font-body text-muted-foreground">
                          • {TYPE_LABELS[mission.type] || mission.type}
                        </span>
                      )}
                      {countdown && (
                        <span className={`text-[10px] font-body flex items-center gap-0.5 ${
                          isUrgent ? "text-destructive font-bold" : "text-muted-foreground"
                        }`}>
                          <Clock className="h-3 w-3" /> {countdown}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="Nessuna missione attiva"
          description="Le nuove missioni saranno presto disponibili"
          compact
        />
      )}
    </div>
  );
};

export default ProfileMissions;
