const ATTENDED_STATUSES = new Set(["attended"]);
const ACTIVE_ATTENDANCE_STATUSES = new Set(["registered", "deposit_paid", "paid", "attended"]);

export type EventRegistrationIdentity = {
  id?: string | null;
  event_id?: string | null;
  status?: string | null;
  checked_in?: boolean | null;
  created_at?: string | null;
  events?: { id?: string | null; date?: string | null } | null;
};

const getEventKey = (registration: EventRegistrationIdentity) =>
  registration.event_id || registration.events?.id || registration.id || "";

export const isAttendedRegistration = (registration: EventRegistrationIdentity) =>
  ACTIVE_ATTENDANCE_STATUSES.has(registration.status || "") &&
  (registration.checked_in || ATTENDED_STATUSES.has(registration.status || ""));

const getRegistrationRank = (registration: EventRegistrationIdentity) => {
  if (isAttendedRegistration(registration)) return 5;
  if (ACTIVE_ATTENDANCE_STATUSES.has(registration.status || "")) return 4;
  if (registration.status === "no_show") return 3;
  if (registration.status === "cancelled") return 2;
  return 1;
};

const getRegistrationTime = (registration: EventRegistrationIdentity) => {
  const value = registration.created_at || registration.events?.date;
  return value ? new Date(value).getTime() || 0 : 0;
};

export const dedupeRegistrationsByEvent = <T extends EventRegistrationIdentity>(registrations: T[]) => {
  const byEvent = new Map<string, T>();

  registrations.forEach((registration) => {
    const key = getEventKey(registration);
    if (!key) return;

    const current = byEvent.get(key);
    if (!current) {
      byEvent.set(key, registration);
      return;
    }

    const nextRank = getRegistrationRank(registration);
    const currentRank = getRegistrationRank(current);
    if (
      nextRank > currentRank ||
      (nextRank === currentRank && getRegistrationTime(registration) > getRegistrationTime(current))
    ) {
      byEvent.set(key, registration);
    }
  });

  return Array.from(byEvent.values());
};

export const countUniqueAttendedEvents = (registrations: EventRegistrationIdentity[]) =>
  dedupeRegistrationsByEvent(registrations).filter(isAttendedRegistration).length;
