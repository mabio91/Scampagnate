import { useAuth } from "@/contexts/AuthContext";
import { useUserMissions, useActiveMissions } from "@/hooks/useMissions";
import { Progress } from "@/components/ui/progress";
import { Target, Gift, CheckCircle } from "lucide-react";
import EmptyState from "@/components/EmptyState";

const ProfileMissions = () => {
  const { user } = useAuth();
  const { data: userMissions = [] } = useUserMissions(user?.id);
  const { data: activeMissions = [] } = useActiveMissions();

  // Merge: show user's active missions with progress, or show available missions
  const missionsToShow = userMissions.length > 0
    ? userMissions.map(um => ({
        id: um.mission_id,
        title: um.missions?.title || "",
        description: um.missions?.description || "",
        progress: um.progress,
        target: um.missions?.target_value || 1,
        rewardPoints: um.missions?.reward_points || 0,
        completed: um.completed,
        type: um.missions?.type || "one_time",
      }))
    : activeMissions.slice(0, 3).map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        progress: 0,
        target: m.target_value,
        rewardPoints: m.reward_points,
        completed: false,
        type: m.type,
      }));

  return (
    <div className="mb-6 animate-fade-in">
      <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-secondary" /> Obiettivi
      </h2>

      {missionsToShow.length > 0 ? (
        <div className="space-y-2">
          {missionsToShow.map((mission) => (
            <div
              key={mission.id}
              className={`p-3 rounded-xl border transition-all duration-200 ${
                mission.completed
                  ? "bg-primary/5 border-primary/20"
                  : "bg-card border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  mission.completed ? "bg-primary/10" : "bg-muted"
                }`}>
                  {mission.completed ? (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <Target className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-semibold text-foreground">{mission.title}</p>
                  <p className="text-[11px] font-body text-muted-foreground">{mission.description}</p>
                  
                  {!mission.completed && (
                    <div className="flex items-center gap-2 mt-2">
                      <Progress
                        value={(mission.progress / mission.target) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-[10px] font-display text-muted-foreground font-bold whitespace-nowrap">
                        {mission.progress}/{mission.target}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 mt-1.5">
                    <Gift className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-body font-semibold text-primary">
                      +{mission.rewardPoints} punti
                    </span>
                    {mission.type !== "one_time" && (
                      <span className="text-[10px] font-body text-muted-foreground ml-1">
                        • {mission.type === "weekly" ? "Settimanale" : "Mensile"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="Nessun obiettivo attivo"
          description="I nuovi obiettivi saranno presto disponibili"
          compact
        />
      )}
    </div>
  );
};

export default ProfileMissions;
