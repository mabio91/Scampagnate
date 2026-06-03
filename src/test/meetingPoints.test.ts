import { describe, expect, it } from "vitest";
import {
  getRemovedMeetingPointIds,
  getRetainedMeetingPointIds,
  sortMeetingPointsChronologically,
} from "@/lib/meetingPoints";

describe("meeting point persistence helpers", () => {
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

  it("sorts meeting points by time without mutating the original order", () => {
    const points = [
      { id: "late", time: "09:50" },
      { id: "early", time: "08:40" },
      { id: "mid", time: "09:00" },
    ];

    expect(sortMeetingPointsChronologically(points).map((point) => point.id)).toEqual([
      "early",
      "mid",
      "late",
    ]);
    expect(points.map((point) => point.id)).toEqual(["late", "early", "mid"]);
  });

  it("keeps missing or invalid times last and preserves relative order for ties", () => {
    const points = [
      { id: "invalid", time: "a voce" },
      { id: "first-nine", time: "09:00" },
      { id: "no-time", time: null },
      { id: "dotted", time: "8.40" },
      { id: "second-nine", time: "09:00:00" },
    ];

    expect(sortMeetingPointsChronologically(points).map((point) => point.id)).toEqual([
      "dotted",
      "first-nine",
      "second-nine",
      "invalid",
      "no-time",
    ]);
  });
});
