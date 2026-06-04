import { parseEventDateTime } from "@/lib/timezone";

type EventTiming = {
  date?: string | null;
  time?: string | null;
  duration?: string | null;
  status?: string | null;
};

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

const parseEventDateParts = (date: string | null | undefined) => {
  const match = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
};

const nextLocalDateString = (date: string | null | undefined) => {
  const parts = parseEventDateParts(date);
  if (!parts) return null;
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getEventStartDateTime = (event: EventTiming): Date | null => {
  if (!event.date || !event.time) return null;
  return parseEventDateTime(event.date, event.time);
};

export const getEventEndOfDayDateTime = (date: string | null | undefined): Date | null => {
  const nextDate = nextLocalDateString(date);
  return nextDate ? parseEventDateTime(nextDate, "00:00:00") : null;
};

export const getEventEndDateTime = (event: EventTiming): Date | null => {
  const start = getEventStartDateTime(event);
  const durationMinutes = parseEventDurationMinutes(event.duration);
  if (start && durationMinutes) {
    return new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  return getEventEndOfDayDateTime(event.date);
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

export function isEventStartedByDateTime(event: EventTiming, referenceDate = new Date()): boolean {
  const startDate = getEventStartDateTime(event);
  return startDate ? startDate.getTime() <= referenceDate.getTime() : false;
}

export function isEventUpcomingByDateTime(event: EventTiming, referenceDate = new Date()): boolean {
  if (COMPLETED_EVENT_STATUSES.has(String(event.status || ""))) return false;

  const endDate = getEventEndDateTime(event);
  if (endDate) return endDate.getTime() > referenceDate.getTime();

  return isEventUpcomingByDate(event.date, referenceDate);
}
