import { useAuth } from "@/contexts/AuthContext";
import { useCommunityLevel, useAllCommunityLevels } from "@/hooks/useCommunityLevel";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp } from "lucide-react";

const LEVEL_VISUALS: Record<number, { icon: string[]; decoration: string }> = {
  1: { icon: ["🌱"], decoration: "" },
  2: { icon: ["🥾"], decoration: "⭐" },
  3: { icon: ["🗺️"], decoration: "⭐" },
  4: { icon: ["⛰️"], decoration: "⭐⭐" },
  5: { icon: ["👑"], decoration: "👑" },
  6: { icon: ["👑", "🔥"], decoration: "👑🔥" },
};

const ProfileGamification = () => {
  const { profile } = useAuth();
  const points = profile?.total_points || 0;
  const { data: currentLevel } = useCommunityLevel(points);
  const { data: allLevels = [] } = useAllCommunityLevels();

  if (!currentLevel) return null;

  const nextLevel = allLevels.find((l) => l.min_points > points);
  const progressToNext = nextLevel
    ? ((points - currentLevel.min_points) / (nextLevel.min_points - currentLevel.min_points)) * 100
    : 100;
  const pointsToNext = nextLevel ? nextLevel.min_points - points : 0;

  const visual = LEVEL_VISUALS[currentLevel.level_number] || LEVEL_VISUALS[1];

  return (
    <div className="mb-6 animate-fade-in">
      <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-secondary" /> Progressione
      </h2>

      <div className="p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold text-foreground">
              {points.toLocaleString("it-IT")} punti
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div
            className="relative w-12 h-12 shrink-0 rounded-full"
            style={{ backgroundColor: `${currentLevel.color}20`, border: `2px solid ${currentLevel.color}` }}
          >
            <span className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 text-lg leading-none">
              {visual.icon[0]}
            </span>
            {visual.icon[1] && (
              <span className="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 text-base leading-none">
                {visual.icon[1]}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-display font-bold text-foreground">
              Livello {currentLevel.level_number}: {currentLevel.name}
            </p>
            {nextLevel ? (
              <p className="text-xs font-body text-muted-foreground">
                {pointsToNext} punti per {nextLevel.name}
              </p>
            ) : (
              <p className="text-xs font-body text-primary font-semibold">
                Livello massimo raggiunto! 🔥
              </p>
            )}
          </div>
        </div>

        {nextLevel && (
          <div className="flex items-center gap-2">
            <Progress value={progressToNext} className="h-2 flex-1" />
            <span className="text-[10px] font-display font-bold text-muted-foreground whitespace-nowrap">
              {points}/{nextLevel.min_points}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileGamification;
