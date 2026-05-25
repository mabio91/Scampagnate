import { memo } from "react";
import { UI_LABELS } from "@/lib/labels";

export type QuickFilterType = "lastSpots" | "weekendAway" | "easy" | "intermediate" | "challenging";

const FILTERS: { key: QuickFilterType; label: string; emoji: string }[] = [
  { key: "lastSpots", label: UI_LABELS.filterLastSpots, emoji: "🔥" },
  { key: "weekendAway", label: UI_LABELS.filterWeekendAway, emoji: "🎒" },
  { key: "easy", label: UI_LABELS.filterEasy, emoji: "🌱" },
  { key: "intermediate", label: UI_LABELS.filterIntermediate, emoji: "⛰️" },
  { key: "challenging", label: UI_LABELS.filterChallenging, emoji: "🧗" },
];

interface Props {
  active: QuickFilterType[];
  onToggle: (f: QuickFilterType) => void;
}

const QuickFilters = memo(({ active, onToggle }: Props) => (
  <div className="px-4">
    <div className="overflow-x-auto py-1 no-scrollbar scroll-px-0">
      <div className="flex w-max min-w-full gap-2">
        {FILTERS.map(({ key, label, emoji }) => {
          const isActive = active.includes(key);
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all active:scale-95 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span aria-hidden="true" className="text-sm leading-none">{emoji}</span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  </div>
));

QuickFilters.displayName = "QuickFilters";
export default QuickFilters;
