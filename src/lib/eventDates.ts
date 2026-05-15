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
