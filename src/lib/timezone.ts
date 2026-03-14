import { format, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

export const PLATFORM_TIMEZONE = "Europe/Rome";

/**
 * Parses a date and time string representing local time in Europe/Rome
 * and returns a standard UTC Date object.
 * 
 * @param dateStr Format: "YYYY-MM-DD"
 * @param timeStr Format: "HH:mm" (or "HH:mm:ss")
 * @returns Date object representing that exact moment in UTC
 */
export const parseEventDateTime = (dateStr: string, timeStr: string): Date => {
  if (!dateStr || !timeStr) return new Date();
  
  // Combine date and time (ignoring the browser's local timezone)
  // "2023-10-25T14:30:00"
  const dateTimeString = `${dateStr}T${timeStr.length === 5 ? timeStr + ':00' : timeStr}`;
  
  // Interpret the constructed string as being in Europe/Rome, returning the absolute UTC Date
  return fromZonedTime(dateTimeString, PLATFORM_TIMEZONE);
};

/**
 * Formats a given Date object to a string in the platform timezone.
 */
export const formatEventDateTime = (date: Date, formatStr: string): string => {
  return formatInTimeZone(date, PLATFORM_TIMEZONE, formatStr);
};
