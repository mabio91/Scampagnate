import { memo } from "react";
import { Star, Flame, CalendarClock, Gift } from "lucide-react";
import { UI_LABELS } from "@/lib/labels";

export type QuickFilterType = "featured" | "lastSpots" | "thisWeek" | "free";

const FILTERS: { key: QuickFilterType; label: string; icon: typeof Star }[] = [
  { key: "featured", label: UI_LABELS.filterFeatured, icon: Star },
  { key: "lastSpots", label: UI_LABELS.filterLastSpots, icon: Flame },
  { key: "thisWeek", label: UI_LABELS.filterThisWeek, icon: CalendarClock },
  { key: "free", label: UI_LABELS.filterFree, icon: Gift },
];

interface Props {
  active: QuickFilterType[];
  onToggle: (f: QuickFilterType) => void;
}

const QuickFilters = memo(({ active, onToggle }: Props) => (
  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar px-4">
    {FILTERS.map(({ key, label, icon: Icon }) => {
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
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      );
    })}
  </div>
));

QuickFilters.displayName = "QuickFilters";
export default QuickFilters;
