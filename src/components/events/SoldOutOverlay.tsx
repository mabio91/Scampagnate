import { cn } from "@/lib/utils";

type SoldOutOverlayProps = {
  size?: "card" | "hero";
  className?: string;
};

const SIZE_STYLES: Record<NonNullable<SoldOutOverlayProps["size"]>, string> = {
  card: "px-5 py-1.5 text-[10px] sm:text-xs",
  hero: "px-7 py-2 text-xs sm:text-sm",
};

export function SoldOutOverlay({ size = "card", className }: SoldOutOverlayProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <div
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full",
          "bg-secondary text-secondary-foreground shadow-xl",
          "font-display font-bold uppercase tracking-[0.16em] whitespace-nowrap",
          "border border-secondary-foreground/10",
          SIZE_STYLES[size],
        )}
      >
        Sold Out
      </div>
    </div>
  );
}

export default SoldOutOverlay;
