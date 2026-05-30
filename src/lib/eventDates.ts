import { parseEventDateTime } from "@/lib/timezone";

type EventTiming = {
  date?: string | null;
  time?: string | null;
  duration?: string | null;
  status?: string | null;
};

const DEFAULT_EVENT_DURATION_MINUTES = 3 * 60;
const COMPLETED_EVENT_STATUSES = new Set(["past", "completed"]);

const parseLocalizedNumber = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseEventDurationMinutes = (duration: string | null | undefined) => {
  if (!duration) return null;

  const lower = duration.trim().toLowerCase();
  if (!lower) return null;

  const days = parseLocalizedNumber(lower.match(/(\d+(?:[,.]\d+)?)\s*(?:giorn(?:o|i)?|gg|g|days?|d)\b/i)?.[1]) || 0;
  const hours = parseLocalizedNumber(lower.match(/(\d+(?:[,.]\d+)?)\s*(?:h|ore?|hours?)\b/i)?.[1]) || 0;
  const minutes = parseLocalizedNumber(lower.match(/(\d+(?:[,.]\d+)?)\s*(?:m|min|mins|minuti?)\b/i)?.[1]) || 0;
  const total = days * 24 * 60 + hours * 60 + minutes;

  return total > 0 ? Math.round(total) : null;
};

export const getEventEndDateTime = (
  event: EventTiming,
  fallbackDurationMinutes = DEFAULT_EVENT_DURATION_MINUTES,
): Date | null => {
  if (!event.date || !event.time) return null;

  const start = parseEventDateTime(event.date, event.time);
  const durationMinutes = parseEventDurationMinutes(event.duration) ?? fallbackDurationMinutes;

  return new Date(start.getTime() + durationMinutes * 60 * 1000);
};

export function parseEventCalendarDate(date?: string | null): Date | null {
  if (!date) return null;
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isEventPastByDate(date?: string | null, referenceDate = new Date()): boolean {
  const eventDate = parseEventCalendarDate(date);
  if (!eventDate) return false;
  return startOfLocalDay(eventDate) < startOfLocalDay(referenceDate);
}

export function isEventUpcomingByDate(date?: string | null, referenceDate = new Date()): boolean {
  const eventDate = parseEventCalendarDate(date);
  if (!eventDate) return false;
  return startOfLocalDay(eventDate) >= startOfLocalDay(referenceDate);
}

export function isEventPastByDateTime(event: EventTiming, referenceDate = new Date()): boolean {
  if (COMPLETED_EVENT_STATUSES.has(String(event.status || ""))) return true;

  const endDate = getEventEndDateTime(event);
  if (endDate) return endDate.getTime() <= referenceDate.getTime();

  return isEventPastByDate(event.date, referenceDate);
}

export function isEventUpcomingByDateTime(event: EventTiming, referenceDate = new Date()): boolean {
  if (COMPLETED_EVENT_STATUSES.has(String(event.status || ""))) return false;

  const endDate = getEventEndDateTime(event);
  if (endDate) return endDate.getTime() > referenceDate.getTime();

  return isEventUpcomingByDate(event.date, referenceDate);
}
