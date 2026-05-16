import { describe, expect, it } from "vitest";
import {
  canOptionJoinWaitlist,
  isEventSoldOut,
  isOptionBookable,
  shouldShowPublicCapacity,
} from "@/lib/priceOptions";

describe("event availability helpers", () => {
  it("keeps an open event with free spots bookable", () => {
    const event = { status: "published", spots_total: 10, spots_taken: 7 };

    expect(isOptionBookable(null, event)).toBe(true);
    expect(isEventSoldOut(event)).toBe(false);
    expect(shouldShowPublicCapacity(event)).toBe(true);
  });

  it("treats capacity sold out as sold out and allows waitlist only when enabled", () => {
    const event = {
      status: "published",
      spots_total: 1,
      spots_taken: 1,
      additional_fields: { waiting_list_enabled: true },
    };

    expect(isEventSoldOut(event)).toBe(true);
    expect(isOptionBookable(null, event)).toBe(false);
    expect(canOptionJoinWaitlist(null, event)).toBe(true);
  });

  it("hides public capacity for manual sold out events that are not full", () => {
    const event = { status: "full", spots_total: 10, spots_taken: 7 };

    expect(isEventSoldOut(event)).toBe(true);
    expect(shouldShowPublicCapacity(event)).toBe(false);
    expect(isOptionBookable(null, event)).toBe(false);
  });

  it("does not open registrations or waitlist for non-open states", () => {
    const event = {
      status: "upcoming",
      spots_total: 10,
      spots_taken: 1,
      additional_fields: { waiting_list_enabled: true },
    };

    expect(isOptionBookable(null, event)).toBe(false);
    expect(canOptionJoinWaitlist(null, event)).toBe(false);
  });

  it("ignores per-formula waitlist when the event waitlist is off", () => {
    const event = {
      status: "published",
      spots_total: 1,
      spots_taken: 1,
      additional_fields: { waiting_list_enabled: false },
    };
    const option = {
      has_dedicated_spots: true,
      dedicated_spots: 1,
      spots_taken: 1,
      waitlist_enabled: true,
    };

    expect(canOptionJoinWaitlist(option, event)).toBe(false);
  });
});
