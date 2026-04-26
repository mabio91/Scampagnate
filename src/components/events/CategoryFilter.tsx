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
  selected: string | null;
  onSelect: (cat: string | null) => void;
}

const CategoryFilter = memo(({ categories, selected, onSelect }: CategoryFilterProps) => (
  <div className="overflow-hidden px-4 py-3">
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-body font-medium transition-all active:scale-95 snap-start ${
          selected === null
            ? "bg-primary text-primary-foreground shadow-md"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {UI_LABELS.all}
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(selected === cat.name ? null : cat.name)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-body font-medium transition-all active:scale-95 snap-start ${
            selected === cat.name
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
));

CategoryFilter.displayName = "CategoryFilter";
export default CategoryFilter;
