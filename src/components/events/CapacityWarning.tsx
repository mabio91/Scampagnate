import { Flame, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface CapacityWarningProps {
  spotsTaken: number;
  spotsTotal: number;
  className?: string;
  variant?: "small" | "large";
}

export const CapacityWarning = ({ spotsTaken, spotsTotal, className, variant = "small" }: CapacityWarningProps) => {
  const spotsLeft = spotsTotal - spotsTaken;
  
  if (spotsLeft <= 0) return null;

  // Logic 1: Only X spots left (high priority)
  if (spotsLeft <= 3) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 text-destructive font-body font-bold animate-pulse-slow",
        variant === "small" ? "text-[10px]" : "text-sm",
        className
      )}>
        <Info className={variant === "small" ? "h-3 w-3" : "h-4 w-4"} />
        <span>Only {spotsLeft} spot{spotsLeft > 1 ? 's' : ''} left</span>
      </div>
    );
  }

  // Logic 2: Almost full 🔥 (medium priority)
  const fillPercent = spotsTaken / spotsTotal;
  if (fillPercent >= 0.8) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 text-warning font-body font-bold",
        variant === "small" ? "text-[10px]" : "text-sm",
        className
      )}>
        <Flame className={variant === "small" ? "h-3 w-3" : "h-4 w-4"} />
        <span>Almost full 🔥</span>
      </div>
    );
  }

  return null;
};
