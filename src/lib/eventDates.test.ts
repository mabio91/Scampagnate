import { describe, expect, it } from "vitest";

import {
  compareEventsByRelevantDateTime,
  comparePastEventsByDateTime,
  compareUpcomingEventsByDateTime,
} from "./eventDates";

describe("event date sorting", () => {
  it("sorts upcoming events from nearest to farthest", () => {
    const events = [
      { id: "late", title: "Late", date: "2026-06-20", time: "10:00", status: "open" },
      { id: "early", title: "Early", date: "2026-06-12", time: "18:30", status: "open" },
      { id: "same-day", title: "Same day", date: "2026-06-12", time: "09:00", status: "open" },
    ];

    expect(events.sort(compareUpcomingEventsByDateTime).map((event) => event.id)).toEqual([
      "same-day",
      "early",
      "late",
    ]);
  });

  it("sorts past events from most recent to oldest", () => {
    const events = [
      { id: "old", title: "Old", date: "2026-05-01", time: "10:00", status: "completed" },
      { id: "recent", title: "Recent", date: "2026-06-08", time: "18:30", status: "completed" },
      { id: "middle", title: "Middle", date: "2026-05-20", time: "09:00", status: "completed" },
    ];

    expect(events.sort(comparePastEventsByDateTime).map((event) => event.id)).toEqual([
      "recent",
      "middle",
      "old",
    ]);
  });

  it("sorts saved events by relevant event date", () => {
    const referenceDate = new Date("2026-06-10T10:00:00.000Z");
    const events = [
      { id: "past", title: "Past", date: "2026-06-08", time: "10:00", status: "completed" },
      { id: "future-far", title: "Future far", date: "2026-06-20", time: "10:00", status: "open" },
      { id: "future-near", title: "Future near", date: "2026-06-12", time: "10:00", status: "open" },
    ];

    expect(events.sort((left, right) => compareEventsByRelevantDateTime(left, right, referenceDate)).map((event) => event.id)).toEqual([
      "future-near",
      "future-far",
      "past",
    ]);
  });
});
