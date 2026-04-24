import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EventBadgePillProps {
  className?: string;
  children: ReactNode;
}

export const eventBadgePillClassName =
  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-body font-semibold leading-none";

export const EventBadgePill = ({ className, children }: EventBadgePillProps) => {
  return <span className={cn(eventBadgePillClassName, className)}>{children}</span>;
};
