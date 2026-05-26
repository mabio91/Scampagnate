import { memo } from "react";
import { UI_LABELS } from "@/lib/labels";
import DynamicIcon from "@/components/DynamicIcon";

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface CategoryFilterProps {
  categories: Category[];
  selected: string[];
  onToggle: (cat: string) => void;
  onClear: () => void;
}

const CategoryFilter = memo(({ categories, selected, onToggle, onClear }: CategoryFilterProps) => (
  <div className="px-4 py-3">
    <div className="overflow-x-auto py-1 no-scrollbar snap-x scroll-px-0">
      <div className="flex w-max min-w-full gap-2">
        <button
          onClick={onClear}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-body font-medium transition-all active:scale-95 snap-start ${
            selected.length === 0
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {UI_LABELS.all}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onToggle(cat.name)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-body font-medium transition-all active:scale-95 snap-start ${
              selected.includes(cat.name)
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat.icon && <DynamicIcon value={cat.icon} size={16} />}
            <span className="whitespace-nowrap">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
));

CategoryFilter.displayName = "CategoryFilter";
export default CategoryFilter;
