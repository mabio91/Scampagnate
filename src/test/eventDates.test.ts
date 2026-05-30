import { describe, expect, it } from "vitest";

import {
  getEventEndDateTime,
  isEventPastByDateTime,
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
