import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMissions, useActiveMissions } from "@/hooks/useMissions";
import { useSearch } from "@/contexts/SearchContext";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Target,
  Gift,
  CheckCircle,
  ChevronRight,
  Clock,
  Ticket,
  Trophy,
  Beer,
  ChevronDown,
} from "lucide-react";
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
  points: Gift,
  coupon: Ticket,
  badge: Trophy,
  physical: Beer,
};

const VISIBLE_ACTIVE_MISSIONS = 3;

const getFilterForMission = (mission: any): { category?: string; quickFilter?: string } => {
  if (mission.category) return { category: mission.category };
  if (mission.target_action === "limited_spots") return { quickFilter: "lastSpots" };
  return {};
};

const getMissionProgressValue = (mission: any) => {
  const target = Number(mission.target || 0);
  if (target <= 0) return 0;
  return Math.min(Number(mission.progress || 0), target) / target;
};

const normalizeRewards = (mission: any) => {
  const configuredRewards = Array.isArray(mission.mission_rewards)
    ? mission.mission_rewards
        .filter((reward: any) => reward.visible_on_profile !== false)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : [];

  if (configuredRewards.length > 0) return configuredRewards;

  const legacyRewards = [];
  if (Number(mission.rewardPoints || 0) > 0) {
    legacyRewards.push({
      id: `${mission.id}-points`,
      reward_kind: "points",
      points_value: Number(mission.rewardPoints),
    });
  }
  if (mission.reward_type && mission.reward_type !== "points") {
    legacyRewards.push({
      id: `${mission.id}-${mission.reward_type}`,
      reward_kind: mission.reward_type,
      title: mission.reward_value,
    });
  }
  return legacyRewards;
};

const getRewardLabel = (reward: any) => {
  if (reward.reward_kind === "points") return `+${reward.points_value || 0} punti`;
  if (reward.reward_kind === "coupon") return "Sblocca uno sconto";
  if (reward.reward_kind === "badge") return "Sblocca un badge";
  return reward.title || "Premio al completamento";
};

const getCompletionRewardText = (mission: any) => {
  const parts = normalizeRewards(mission)
    .map((reward: any) => {
      if (reward.reward_kind === "points" && Number(reward.points_value || 0) > 0) {
        return `+${reward.points_value} punti`;
      }
      if (reward.reward_kind === "badge") {
        return reward.badges?.name ? `badge ${reward.badges.name}` : "un badge";
      }
      if (reward.reward_kind === "coupon") return "uno sconto";
      return reward.title || null;
    })
    .filter(Boolean);

  return parts.length > 0 ? `Hai sbloccato ${parts.join(", ")}.` : mission.title;
};

const getMissionCompletionToastKey = (userId: string, mission: any) =>
  `scampagnate:mission-toast:${userId}:${mission.id}:${mission.completed_at || "completed"}`;

const hasSeenMissionCompletionToast = (key: string) => {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(key) === "1";
};

const markMissionCompletionToastSeen = (key: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, "1");
};

const ProfileMissions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setSelectedCategory, toggleQuickFilter, clearAllFilters } = useSearch();
  const { data: userMissions = [], isFetched: userMissionsFetched } = useUserMissions(user?.id);
  const { data: activeMissions = [], isFetched: activeMissionsFetched } = useActiveMissions();
  const [extraActiveOpen, setExtraActiveOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<any | null>(null);
  const initializedCompletions = useRef(false);
  const previousCompletedIds = useRef<Set<string>>(new Set());

  const missionsToShow = useMemo(() => {
    const userMissionMap = new Map(userMissions.map((mission) => [mission.mission_id, mission]));

    if (activeMissions.length > 0) {
      return activeMissions.map((mission) => {
        const userMission = userMissionMap.get(mission.id);

        return {
          id: mission.id,
          title: mission.title,
          description: mission.description,
          progress: userMission?.progress ?? 0,
          target: mission.target_value || 1,
          rewardPoints: mission.reward_points,
          completed: userMission?.completed ?? false,
          type: mission.type,
          icon: (mission as any).icon || "lucide:Target",
          reward_type: (mission as any).reward_type || "points",
          reward_value: (mission as any).reward_value || null,
          mission_rewards: (mission as any).mission_rewards || [],
          completed_at: userMission?.completed_at || null,
          category: mission.category || null,
          target_action: (mission as any)?.target_action || "event_attended",
          expires_at: (mission as any)?.expires_at || null,
        };
      });
    }

    return userMissions.map((mission) => ({
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
      mission_rewards: (mission.missions as any)?.mission_rewards || [],
      completed_at: mission.completed_at || null,
      category: (mission.missions as any)?.category || null,
      target_action: (mission.missions as any)?.target_action || "event_attended",
      expires_at: (mission.missions as any)?.expires_at || null,
    }));
  }, [activeMissions, userMissions]);

  const activeMissionCards = useMemo(() => (
    missionsToShow
      .map((mission, index) => ({ mission, index }))
      .filter(({ mission }) => !mission.completed)
      .sort((a, b) => {
        const progressDelta = getMissionProgressValue(b.mission) - getMissionProgressValue(a.mission);
        return progressDelta !== 0 ? progressDelta : a.index - b.index;
      })
      .map(({ mission }) => mission)
  ), [missionsToShow]);

  const completedMissionCards = useMemo(
    () => missionsToShow.filter((mission) => mission.completed),
    [missionsToShow],
  );

  const visibleActiveMissionCards = activeMissionCards.slice(0, VISIBLE_ACTIVE_MISSIONS);
  const extraActiveMissionCards = activeMissionCards.slice(VISIBLE_ACTIVE_MISSIONS);
  const extraActiveMissionTriggerLabel = extraActiveMissionCards.length === 1
    ? "Mostra 1 altra missione"
    : `Mostra altre ${extraActiveMissionCards.length} missioni`;

  useEffect(() => {
    if (!user?.id || !userMissionsFetched || !activeMissionsFetched) return;

    const currentCompleted = new Set(completedMissionCards.map((mission) => mission.id));

    if (!initializedCompletions.current) {
      previousCompletedIds.current = currentCompleted;
      initializedCompletions.current = true;
      completedMissionCards.forEach((mission) => {
        markMissionCompletionToastSeen(getMissionCompletionToastKey(user.id, mission));
      });
      return;
    }

    completedMissionCards
      .filter((mission) => !previousCompletedIds.current.has(mission.id))
      .forEach((mission) => {
        const toastKey = getMissionCompletionToastKey(user.id, mission);
        if (hasSeenMissionCompletionToast(toastKey)) return;

        markMissionCompletionToastSeen(toastKey);
        toast({
          title: "Missione completata",
          description: getCompletionRewardText(mission),
        });
      });

    previousCompletedIds.current = currentCompleted;
  }, [activeMissionsFetched, completedMissionCards, toast, user?.id, userMissionsFetched]);

  const openEventsForMission = (mission: any) => {
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

  const handleMissionClick = (mission: any) => {
    setSelectedMission(mission);
  };

  const getCountdown = (expiresAt: string | null): string | null => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Scaduta";
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 1) return "Scade domani";
    return `${days} giorni rimasti`;
  };

  const renderMissionCard = (mission: any) => {
    const rewards = normalizeRewards(mission);
    const countdown = getCountdown(mission.expires_at);
    const isUrgent = countdown && !countdown.includes("Scaduta") && parseInt(countdown) <= 3;
    const hasNonPointReward = rewards.some((reward: any) => reward.reward_kind !== "points");
    const progressValue = mission.target > 0 ? (Math.min(mission.progress, mission.target) / mission.target) * 100 : 0;

    return (
      <button
        key={mission.id}
        onClick={() => handleMissionClick(mission)}
        className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group ${
          mission.completed
            ? "bg-primary/5 border-primary/20"
            : hasNonPointReward
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
                value={progressValue}
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

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {rewards.map((reward: any) => {
                if (reward.reward_kind === "points" && Number(reward.points_value || 0) <= 0) return null;
                const RewardIcon = REWARD_ICONS[reward.reward_kind] || Gift;

                return (
                  <div key={reward.id || `${mission.id}-${reward.reward_kind}`} className="flex items-center gap-1">
                    <RewardIcon className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-body font-semibold text-primary">
                      {getRewardLabel(reward)}
                    </span>
                  </div>
                );
              })}
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
  };

  return (
    <>
      <div className="mb-6 animate-fade-in">
        <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-secondary" /> Missioni
        </h2>

        {missionsToShow.length > 0 ? (
          <div className="space-y-3">
            {activeMissionCards.length > 0 ? (
              <div className="space-y-2">
                {visibleActiveMissionCards.map(renderMissionCard)}

                {extraActiveMissionCards.length > 0 && (
                  <Collapsible open={extraActiveOpen} onOpenChange={setExtraActiveOpen}>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left text-xs font-display font-bold text-muted-foreground uppercase tracking-wider transition-colors hover:text-primary">
                      <span>{extraActiveOpen ? "Nascondi missioni" : extraActiveMissionTriggerLabel}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${extraActiveOpen ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-1">
                      {extraActiveMissionCards.map(renderMissionCard)}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Target}
                title="Nessuna missione attiva"
                description="Hai completato tutte le missioni disponibili"
                compact
              />
            )}

            {completedMissionCards.length > 0 && (
              <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between py-2 text-left">
                  <span className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">
                    Missioni completate
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${completedOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2">
                  {completedMissionCards.map(renderMissionCard)}
                </CollapsibleContent>
              </Collapsible>
            )}
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

      <Dialog open={!!selectedMission} onOpenChange={(open) => !open && setSelectedMission(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          {selectedMission && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedMission.completed ? (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <DynamicIcon value={selectedMission.icon} size={20} className="text-secondary" />
                  )}
                  {selectedMission.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedMission.description && (
                  <p className="text-sm font-body text-muted-foreground">{selectedMission.description}</p>
                )}
                <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-body font-semibold">
                    <span>Avanzamento</span>
                    <span className="text-primary">{Math.min(selectedMission.progress, selectedMission.target)} di {selectedMission.target}</span>
                  </div>
                  <Progress
                    value={selectedMission.target > 0 ? (Math.min(selectedMission.progress, selectedMission.target) / selectedMission.target) * 100 : 0}
                    className="h-1.5"
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedMission.completed ? "Missione completata. La ricompensa collegata è stata sbloccata." : "Continua con gli eventi adatti per completarla."}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {normalizeRewards(selectedMission).map((reward: any) => {
                    if (reward.reward_kind === "points" && Number(reward.points_value || 0) <= 0) return null;
                    const RewardIcon = REWARD_ICONS[reward.reward_kind] || Gift;
                    return (
                      <div key={reward.id || `${selectedMission.id}-${reward.reward_kind}`} className="flex items-center gap-2 text-xs font-body font-semibold text-primary">
                        <RewardIcon className="h-3.5 w-3.5" />
                        {getRewardLabel(reward)}
                      </div>
                    );
                  })}
                </div>
                <Button className="w-full" onClick={() => openEventsForMission(selectedMission)}>
                  Scopri gli eventi
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileMissions;
