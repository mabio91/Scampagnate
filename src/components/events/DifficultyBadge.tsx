import { forwardRef } from "react";
import { Sprout, Footprints, Mountain, Dumbbell, Flame, type LucideIcon } from "lucide-react";
import { useTrekkingDifficultyLevels } from "@/hooks/useTrekkingDifficultyLevels";

// Fallback static data (used while DB is loading)
const FALLBACK_LEVELS = [
  { level: "1", name: "Introduzione", color: "text-success", icon: Sprout },
  { level: "2", name: "Esploratore", color: "text-success", icon: Footprints },
  { level: "3", name: "Escursionista", color: "text-warning", icon: Mountain },
  { level: "4", name: "Intrepido", color: "text-orange-500", icon: Dumbbell },
  { level: "5", name: "Avanzato", color: "text-destructive", icon: Flame },
];

const LEVEL_ICONS: Record<number, LucideIcon> = {
  1: Sprout,
  2: Footprints,
  3: Mountain,
  4: Dumbbell,
  5: Flame,
};

// Keep exported for any consumers that only need static icon mapping
export const DIFFICULTY_LEVELS = FALLBACK_LEVELS;

export const getDifficultyDetails = (difficulty: string | null | undefined) => {
  if (!difficulty) return null;
  const found = FALLBACK_LEVELS.find(d => d.level === difficulty || d.name === difficulty);
  return found || null;
};

interface DifficultyBadgeProps {
  difficulty: string | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export const DifficultyBadge = forwardRef<HTMLSpanElement, DifficultyBadgeProps>(
  ({ difficulty, className = "", showLabel = true }, ref) => {
    const { data: dbLevels } = useTrekkingDifficultyLevels();

    if (!difficulty) return null;

    // Try to find from DB data first
    const dbLevel = dbLevels?.find(l => String(l.level_number) === difficulty);

    if (dbLevel) {
      const Icon = LEVEL_ICONS[dbLevel.level_number] || Mountain;
      return (
        <span ref={ref} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/20 text-accent-foreground text-xs font-body font-semibold ${className}`}>
          <Icon className="h-3.5 w-3.5" style={{ color: dbLevel.color_icon }} />
          {showLabel && dbLevel.label}
        </span>
      );
    }

    // Fallback to static data
    const details = getDifficultyDetails(difficulty);
    if (!details) return null;
    const Icon = details.icon;

    return (
      <span ref={ref} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/20 text-accent-foreground text-xs font-body font-semibold ${className}`}>
        <Icon className={`h-3.5 w-3.5 ${details.color}`} />
        {showLabel && details.name}
      </span>
    );
  }
);

DifficultyBadge.displayName = "DifficultyBadge";
