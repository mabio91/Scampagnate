import { FC } from "react";
import { Circle, type LucideIcon } from "lucide-react";

export const DIFFICULTY_LEVELS = [
  { level: "1", name: "Introduzione", color: "text-success", description: "Perfect for beginners. Simple walking routes, very low elevation gain (up to 150-200m), relaxed pace, 1-2 hours." },
  { level: "2", name: "Facile", color: "text-success", description: "Suitable for people who have already done some walking. Moderate elevation gain (200-400m), 2-3 hours." },
  { level: "3", name: "Intermedio", color: "text-warning", description: "Suitable for moderately active people. Longer climbs (400-700m), sustained pace, 3-5 hours." },
  { level: "4", name: "Impegnativo", color: "text-orange-500", description: "Requires good physical condition. Significant elevation gain (700-1100m), more technical terrain, 5-7 hours." },
  { level: "5", name: "Avanzato", color: "text-destructive", description: "Only for experienced hikers. Very high elevation gain (over 1100m), long distances, 7+ hours." },
];

export const getDifficultyDetails = (difficulty: string | null | undefined) => {
  if (!difficulty) return null;
  // It could be the numeric string "1", "2" or the actual string name if old data 
  const found = DIFFICULTY_LEVELS.find(d => d.level === difficulty || d.name === difficulty);
  return found || null;
};

interface DifficultyBadgeProps {
  difficulty: string | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export const DifficultyBadge: FC<DifficultyBadgeProps> = ({ difficulty, className = "", showLabel = true }) => {
  const details = getDifficultyDetails(difficulty);
  if (!details) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/20 text-accent-foreground text-xs font-body font-semibold ${className}`}>
      <Circle className={`h-3 w-3 fill-current ${details.color}`} />
      {showLabel && details.name}
    </span>
  );
};
