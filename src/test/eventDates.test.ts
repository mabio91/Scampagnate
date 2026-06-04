import { describe, expect, it } from "vitest";

import {
  getEventEndDateTime,
  getEventCalendarDateKeys,
  getEventStartDateTime,
  isEventPastByDateTime,
  isEventStartedByDateTime,
  isEventUpcomingByDateTime,
  parseEventDurationMinutes,
} from "@/lib/eventDates";

describe("event date helpers", () => {
  it("parses localized event durations", () => {
    expect(parseEventDurationMinutes("1h 30m")).toBe(90);
    expect(parseEventDurationMinutes("1,5h")).toBe(90);
    expect(parseEventDurationMinutes("90 min")).toBe(90);
    expect(parseEventDurationMinutes("2 giorni")).toBe(2880);
  });

  it("computes the event end from Rome date, time, and duration", () => {
    const end = getEventEndDateTime({ date: "2026-05-30", time: "09:00", duration: "3h" });

    expect(end?.toISOString()).toBe("2026-05-30T10:00:00.000Z");
  });

  it("falls back to midnight after the event day when duration is missing", () => {
    const end = getEventEndDateTime({ date: "2026-05-30", time: "09:00", duration: null });

    expect(end?.toISOString()).toBe("2026-05-30T22:00:00.000Z");
  });

  it("expands multi-day events across every touched calendar date", () => {
    expect(getEventCalendarDateKeys({ date: "2026-05-30", time: "09:00", duration: "2 giorni" })).toEqual([
      "2026-05-30",
      "2026-05-31",
      "2026-06-01",
    ]);
  });

  it("does not include the next date when an event ends exactly at midnight", () => {
    expect(getEventCalendarDateKeys({ date: "2026-05-30", time: "22:00", duration: "2h" })).toEqual([
      "2026-05-30",
    ]);
  });

  it("uses the start date only when duration is missing", () => {
    expect(getEventCalendarDateKeys({ date: "2026-05-30", time: "09:00", duration: null })).toEqual([
      "2026-05-30",
    ]);
  });

  it("detects the event start separately from the event end", () => {
    const event = { date: "2026-05-30", time: "09:00", duration: "3h", status: "open" };

    expect(getEventStartDateTime(event)?.toISOString()).toBe("2026-05-30T07:00:00.000Z");
    expect(isEventStartedByDateTime(event, new Date("2026-05-30T06:59:00.000Z"))).toBe(false);
    expect(isEventStartedByDateTime(event, new Date("2026-05-30T07:00:00.000Z"))).toBe(true);
    expect(isEventPastByDateTime(event, new Date("2026-05-30T09:59:00.000Z"))).toBe(false);
  });

  it("treats a same-day event as past only after its computed end", () => {
    const event = { date: "2026-05-30", time: "09:00", duration: "3h", status: "open" };

    expect(isEventUpcomingByDateTime(event, new Date("2026-05-30T09:59:00.000Z"))).toBe(true);
    expect(isEventPastByDateTime(event, new Date("2026-05-30T10:00:00.000Z"))).toBe(true);
  });

  it("treats completed canonical statuses as past", () => {
    const event = { date: "2026-05-30", time: "23:00", duration: "3h", status: "completed" };

    expect(isEventUpcomingByDateTime(event, new Date("2026-05-30T08:00:00.000Z"))).toBe(false);
    expect(isEventPastByDateTime(event, new Date("2026-05-30T08:00:00.000Z"))).toBe(true);
  });
});
