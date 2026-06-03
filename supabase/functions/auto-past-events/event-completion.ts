export {
  eventEndDate,
  eventStartDate,
  isEventComplete,
  isEventStarted,
  parseEventDurationMinutes,
  PLATFORM_TIME_ZONE,
  toRomeDateString,
  zonedEventStartDate,
  type EventTimingCandidate as EventCompletionCandidate,
} from "../_shared/event-timing.ts";

export const AUTO_CLOSE_EVENT_STATUSES = ["available", "published", "open", "full"] as const;
export const AUTO_COMPLETE_EVENT_STATUSES = ["available", "published", "open", "full", "closed"] as const;
