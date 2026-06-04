import { describe, expect, it } from "vitest";
import {
  canOptionJoinWaitlist,
  getPriceOptionDisplayName,
  hasActivePromotionalPriceOption,
  hasEventLastSpots,
  isEventSoldOut,
  isOptionBookable,
  shouldShowPublicCapacity,
  shouldShowLastSpotsUrgency,
} from "@/lib/priceOptions";

describe("price option display names", () => {
  it("hides empty and generated formula names", () => {
    expect(getPriceOptionDisplayName({ name: null })).toBe("Partecipazione evento");
    expect(getPriceOptionDisplayName({ name: "" })).toBe("Partecipazione evento");
    expect(getPriceOptionDisplayName({ name: "Formula 1" })).toBe("Partecipazione evento");
    expect(getPriceOptionDisplayName({ name: " formula 12 " })).toBe("Partecipazione evento");
  });

  it("keeps organizer-provided formula names", () => {
    expect(getPriceOptionDisplayName({ name: "Quota soci" })).toBe("Quota soci");
    expect(getPriceOptionDisplayName({ name: "Formula famiglia" })).toBe("Formula famiglia");
  });
});

describe("event availability helpers", () => {
  it("keeps an open event with free spots bookable", () => {
    const event = { status: "published", spots_total: 10, spots_taken: 7 };

    expect(isOptionBookable(null, event)).toBe(true);
    expect(isEventSoldOut(event)).toBe(false);
    expect(shouldShowPublicCapacity(event)).toBe(true);
    expect(hasEventLastSpots(event)).toBe(true);
  });

  it("marks last spots at the shared 70 percent threshold only while not sold out", () => {
    expect(hasEventLastSpots({ status: "published", spots_total: 20, spots_taken: 13 })).toBe(false);
    expect(hasEventLastSpots({ status: "published", spots_total: 20, spots_taken: 14 })).toBe(true);
    expect(hasEventLastSpots({ status: "published", spots_total: 20, spots_taken: 20 })).toBe(false);
    expect(hasEventLastSpots({ status: "full", spots_total: 20, spots_taken: 14 })).toBe(false);
  });

  it("hides last spots urgency once the current user is already registered", () => {
    const event = { status: "published", spots_total: 20, spots_taken: 14 };

    expect(shouldShowLastSpotsUrgency(event)).toBe(true);
    expect(shouldShowLastSpotsUrgency(event, { isAlreadyRegistered: true })).toBe(false);
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

  it("shows promo only when a promotional price option is active", () => {
    const now = new Date("2026-05-20T10:00:00.000Z");

    expect(hasActivePromotionalPriceOption([
      { is_promotional: false, promo_start: null, promo_end: null },
      { is_promotional: true, promo_start: "2026-05-21T00:00:00.000Z", promo_end: null },
      { is_promotional: true, promo_start: null, promo_end: "2026-05-19T00:00:00.000Z" },
    ], now)).toBe(false);

    expect(hasActivePromotionalPriceOption([
      { is_promotional: true, promo_start: "2026-05-19T00:00:00.000Z", promo_end: "2026-05-21T00:00:00.000Z" },
    ], now)).toBe(true);
  });
});
