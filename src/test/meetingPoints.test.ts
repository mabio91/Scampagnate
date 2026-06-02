import { describe, expect, it } from "vitest";
import {
  getRemovedMeetingPointIds,
  getRetainedMeetingPointIds,
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
});
