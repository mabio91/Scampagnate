import { forwardRef, type CSSProperties } from "react";
import { Sprout, Footprints, Mountain, Dumbbell, Flame, type LucideIcon } from "lucide-react";
import { useTrekkingDifficultyLevels } from "@/hooks/useTrekkingDifficultyLevels";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";

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
  labelClassName?: string;
  showIcon?: boolean;
  display?: "label" | "fraction";
}

const getDifficultyLevelValue = (
  difficulty: string | null | undefined,
  dbLevelNumber?: number | null,
) => {
  if (dbLevelNumber) return String(dbLevelNumber);
  if (!difficulty) return null;

  const raw = difficulty.trim().toLowerCase();
  if (/^[1-5]$/.test(raw)) return raw;
  if (raw === "beginner" || raw === "easy") return "1";

  const fallback = FALLBACK_LEVELS.find(
    d => d.level === raw || d.name.toLowerCase() === raw,
  );
  return fallback?.level || null;
};

export const DifficultyBadge = forwardRef<HTMLSpanElement, DifficultyBadgeProps>(
  ({
    difficulty,
    className = "",
    showLabel = true,
    labelClassName,
    showIcon = true,
    display = "label",
  }, ref) => {
    const { data: dbLevels } = useTrekkingDifficultyLevels();

    if (!difficulty) return null;

    const normalizedLevelValue = getDifficultyLevelValue(difficulty);

    // Try to find from DB data first
    const dbLevel = dbLevels?.find(l => String(l.level_number) === normalizedLevelValue);

    if (dbLevel) {
      const levelValue = getDifficultyLevelValue(difficulty, dbLevel.level_number);
      const labelText = display === "fraction" && levelValue ? `${levelValue}/5` : dbLevel.label;
      const dbStyle: CSSProperties = {
        backgroundColor: dbLevel.color_background || undefined,
        borderColor: dbLevel.color_border || undefined,
        color: dbLevel.color_primary || undefined,
      };
      
      return (
        <span
          ref={ref}
          className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-body font-semibold leading-none", className)}
          style={dbStyle}
          aria-label={display === "fraction" && levelValue ? `Difficolta ${levelValue} su 5` : undefined}
        >
          {showIcon && (
            <span style={{ color: dbLevel.color_icon || dbLevel.color_primary }} className="flex items-center justify-center">
              <DynamicIcon value={dbLevel.icon} size={14} className="shrink-0" />
            </span>
          )}
          {showLabel && <span className={labelClassName}>{labelText}</span>}
        </span>
      );
    }

    // Fallback to static data
    const details = getDifficultyDetails(difficulty);
    const levelValue = getDifficultyLevelValue(difficulty);
    if (!details) {
      if (display !== "fraction" || !levelValue) return null;

      return (
        <span
          ref={ref}
          className={cn("inline-flex h-7 items-center rounded-full bg-accent/20 px-2.5 text-[10px] font-body font-semibold leading-none text-accent-foreground", className)}
          aria-label={`Difficolta ${levelValue} su 5`}
        >
          {showLabel && <span className={labelClassName}>{levelValue}/5</span>}
        </span>
      );
    }
    const Icon = details.icon;
    const labelText = display === "fraction" && levelValue ? `${levelValue}/5` : details.name;

    return (
      <span
        ref={ref}
        className={cn("inline-flex h-7 items-center gap-1.5 rounded-full bg-accent/20 px-2.5 text-[10px] font-body font-semibold leading-none text-accent-foreground", className)}
        aria-label={display === "fraction" && levelValue ? `Difficolta ${levelValue} su 5` : undefined}
      >
        {showIcon && <Icon className={`h-3.5 w-3.5 ${details.color}`} />}
        {showLabel && <span className={labelClassName}>{labelText}</span>}
      </span>
    );
  }
);

DifficultyBadge.displayName = "DifficultyBadge";
