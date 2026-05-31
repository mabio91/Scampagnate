import { describe, expect, it } from "vitest";
import {
  buildPrimaryMeetingPoint,
  ensurePrimaryMeetingPoint,
  getRemovedMeetingPointIds,
  getRetainedMeetingPointIds,
} from "@/lib/meetingPoints";

describe("meeting point persistence helpers", () => {
  it("derives the primary meeting point from the event location", () => {
    expect(buildPrimaryMeetingPoint({
      location: "Via Roma 1",
      locationLabel: "Parcheggio nord",
      time: "08:30:00",
    })).toEqual({
      name: "Parcheggio nord",
      location: "Via Roma 1",
      time: "08:30",
    });
  });

  it("guarantees a primary meeting point when none were configured", () => {
    const points = ensurePrimaryMeetingPoint(
      [],
      { location: "Via Roma 1", locationLabel: "", time: "09:15" },
      (point) => ({ ...point, notes: "" }),
    );

    expect(points).toEqual([
      { name: "Luogo di ritrovo", location: "Via Roma 1", time: "09:15", notes: "" },
    ]);
  });

  it("updates an existing primary point when the event location changes", () => {
    const points = ensurePrimaryMeetingPoint(
      [
        { id: "mp-1", name: "Vecchio luogo", location: "Via Vecchia 1", time: "08:00", notes: "" },
        { id: "mp-2", name: "Secondo", location: "Via Seconda 2", time: "08:20", notes: "" },
      ],
      { location: "Via Nuova 3", locationLabel: "Nuovo luogo", time: "08:30" },
      (point) => ({ ...point, notes: "" }),
      { location: "Via Vecchia 1", locationLabel: "Vecchio luogo", time: "08:00" },
    );

    expect(points).toEqual([
      { id: "mp-1", name: "Nuovo luogo", location: "Via Nuova 3", time: "08:30", notes: "" },
      { id: "mp-2", name: "Secondo", location: "Via Seconda 2", time: "08:20", notes: "" },
    ]);
  });

  it("retains existing meeting point ids when an event is edited", () => {
    const points = [
      { id: "mp-a" },
      { id: "mp-b" },
      {},
    ];

    expect(getRetainedMeetingPointIds(points)).toEqual(["mp-a", "mp-b"]);
  });

  it("marks only explicitly removed meeting points for deletion", () => {
    const existingIds = ["mp-a", "mp-b", "mp-c"];
    const points = [
      { id: "mp-a" },
      { id: "mp-c" },
      {},
    ];

    expect(getRemovedMeetingPointIds(existingIds, points)).toEqual(["mp-b"]);
  });
});
