const ANALYTICS_EXCLUDED_EVENT_STATUSES = new Set(["draft", "unpublished"]);

type AnalyticsEventLike = { status?: string | null } | null | undefined;

export const isAnalyticsEventStatus = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toLowerCase();
  return !ANALYTICS_EXCLUDED_EVENT_STATUSES.has(normalized);
};

export const isAnalyticsEvent = (event: AnalyticsEventLike) =>
  !!event && isAnalyticsEventStatus(event.status);

export const isAnalyticsRegistration = (registration: {
  events?: AnalyticsEventLike | AnalyticsEventLike[];
}) => {
  const event = Array.isArray(registration.events) ? registration.events[0] : registration.events;
  return isAnalyticsEvent(event);
};
