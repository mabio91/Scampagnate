import { forwardRef } from "react";
import { Flame, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface CapacityWarningProps {
  spotsTaken: number;
  spotsTotal: number;
  className?: string;
  variant?: "small" | "large";
}

export const CapacityWarning = forwardRef<HTMLDivElement, CapacityWarningProps>(
  ({ spotsTaken, spotsTotal, className, variant = "small" }, ref) => {
    const spotsLeft = spotsTotal - spotsTaken;
    
    if (spotsLeft <= 0) return null;

    if (spotsLeft <= 3) {
      return (
        <div ref={ref} className={cn(
          "flex items-center gap-1.5 text-destructive font-body font-bold animate-pulse-slow",
          variant === "small" ? "text-[10px]" : "text-sm",
          className
        )}>
          <Info className={variant === "small" ? "h-3 w-3" : "h-4 w-4"} />
          <span>Only {spotsLeft} spot{spotsLeft > 1 ? 's' : ''} left</span>
        </div>
      );
    }

    const fillPercent = spotsTaken / spotsTotal;
    if (fillPercent >= 0.8) {
      return (
        <div ref={ref} className={cn(
          "flex items-center gap-1.5 text-warning font-body font-bold",
          variant === "small" ? "text-[10px]" : "text-sm",
          className
        )}>
          <Flame className={variant === "small" ? "h-3 w-3" : "h-4 w-4"} />
          <span>Almost full</span>
        </div>
      );
    }

    return null;
  }
);

CapacityWarning.displayName = "CapacityWarning";
