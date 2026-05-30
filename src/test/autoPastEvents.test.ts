import { describe, expect, it } from "vitest";

import {
  eventEndDate,
  isEventComplete,
  parseEventDurationMinutes,
  toRomeDateString,
} from "../../supabase/functions/auto-past-events/event-completion";

describe("auto-past-events completion helpers", () => {
  it("parses combined durations", () => {
    expect(parseEventDurationMinutes("1h 30m")).toBe(90);
    expect(parseEventDurationMinutes("1,5h")).toBe(90);
    expect(parseEventDurationMinutes("2 giorni")).toBe(2880);
  });

  it("computes end dates in Europe/Rome", () => {
    const end = eventEndDate({ date: "2026-05-30", time: "09:00", duration: "3h" });

    expect(end?.toISOString()).toBe("2026-05-30T10:00:00.000Z");
  });

  it("marks an event complete only after the computed end", () => {
    const event = { date: "2026-05-30", time: "09:00", duration: "3h" };

    expect(isEventComplete(event, new Date("2026-05-30T09:59:00.000Z"))).toBe(false);
    expect(isEventComplete(event, new Date("2026-05-30T10:00:00.000Z"))).toBe(true);
  });

  it("uses the Rome day for candidate selection", () => {
    expect(toRomeDateString(new Date("2026-05-29T22:30:00.000Z"))).toBe("2026-05-30");
  });
});
