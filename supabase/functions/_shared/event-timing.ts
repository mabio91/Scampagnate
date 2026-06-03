export const PLATFORM_TIME_ZONE = "Europe/Rome";

export type EventTimingCandidate = {
  date?: string | null;
  time?: string | null;
  duration?: string | null;
};

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

const parseEventTimeParts = (time: string | null | undefined) => {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, hour, minute, second] = match;
  return { hour: Number(hour), minute: Number(minute), second: Number(second || 0) };
};

const formatDateParts = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getNextDateString = (date: string | null | undefined) => {
  const parts = parseEventDateParts(date);
  if (!parts) return null;
  return formatDateParts(new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1)));
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
};

export const zonedEventStartDate = (
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone = PLATFORM_TIME_ZONE,
) => {
  const dateParts = parseEventDateParts(date);
  const timeParts = parseEventTimeParts(time);
  if (!dateParts || !timeParts) return null;

  const localAsUtc = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
  );
  const firstGuess = new Date(localAsUtc);
  const firstOffset = getTimeZoneOffsetMs(firstGuess, timeZone);
  const secondGuess = new Date(localAsUtc - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(secondGuess, timeZone);

  return new Date(localAsUtc - secondOffset);
};

export const eventStartDate = (event: EventTimingCandidate) =>
  zonedEventStartDate(event.date, event.time);

export const eventEndDate = (event: EventTimingCandidate) => {
  const start = eventStartDate(event);
  const durationMinutes = parseEventDurationMinutes(event.duration);
  if (start && durationMinutes) {
    return new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  const nextDate = getNextDateString(event.date);
  return nextDate ? zonedEventStartDate(nextDate, "00:00:00") : null;
};

export const isEventStarted = (event: EventTimingCandidate, referenceDate = new Date()) => {
  const start = eventStartDate(event);
  return start ? start.getTime() <= referenceDate.getTime() : false;
};

export const isEventComplete = (event: EventTimingCandidate, referenceDate = new Date()) => {
  const end = eventEndDate(event);
  return end ? end.getTime() <= referenceDate.getTime() : false;
};

export const toRomeDateString = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
};
