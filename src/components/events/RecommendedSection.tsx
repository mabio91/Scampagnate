import { memo } from "react";
import { Sparkles } from "lucide-react";
import { UI_LABELS } from "@/lib/labels";
import { EventWithDetails } from "@/hooks/useEvents";
import EventCard from "./EventCard";

interface Props {
  events: EventWithDetails[];
}

const RecommendedSection = memo(({ events }: Props) => {
  if (events.length === 0) return null;

  return (
    <div className="px-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">
          {UI_LABELS.recommended}
        </h2>
      </div>
      <p className="text-xs font-body text-muted-foreground mb-3 ml-7">
        {UI_LABELS.recommendedSubtitle}
      </p>
      <div className="space-y-2.5">
        {events.slice(0, 3).map((event, i) => (
          <EventCard key={event.id} event={event} index={i} showCompatibility />
        ))}
      </div>
    </div>
  );
});

RecommendedSection.displayName = "RecommendedSection";
export default RecommendedSection;
