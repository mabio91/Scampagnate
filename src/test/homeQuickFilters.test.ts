import { describe, expect, it } from "vitest";
import {
  getDifficultyLevel,
  matchesAllHomeQuickFilters,
  matchesHomeQuickFilter,
  parseDurationHours,
} from "@/lib/homeQuickFilters";
import type { QuickFilterType } from "@/components/events/QuickFilters";
import type { EventWithDetails } from "@/hooks/useEvents";

const event = (overrides: Partial<EventWithDetails>): EventWithDetails => ({
  id: "event-id",
  title: "Evento",
  description: "",
  date: "2026-06-06",
  time: "09:00",
  location: "Roma",
  category_id: null,
  status: "open",
  price: 0,
  deposit: null,
  payment_type: "free",
  additional_fields: null,
  image_url: null,
  difficulty: null,
  distance: null,
  elevation: null,
  duration: null,
  spots_total: 20,
  spots_taken: 0,
  featured: false,
  organizer_id: null,
  organizer_name: "Scampagnate",
  cancellation_policy: null,
  equipment_list: null,
  visibility: "public",
  gallery_images: null,
  access_rules: null,
  ...overrides,
});

describe("home quick filters", () => {
  it("parses hour and day durations for weekend fuori", () => {
    expect(parseDurationHours("24h")).toBe(24);
    expect(parseDurationHours("24,5h")).toBe(24.5);
    expect(parseDurationHours("1 giorno")).toBe(24);
    expect(parseDurationHours("1.5 giorni")).toBe(36);
    expect(parseDurationHours("2 giorni")).toBe(48);
  });

  it("maps difficulty levels into the requested filter groups", () => {
    expect(getDifficultyLevel("1")).toBe(1);
    expect(getDifficultyLevel("2")).toBe(2);
    expect(getDifficultyLevel("Escursionista")).toBe(3);
    expect(getDifficultyLevel("Intrepido")).toBe(4);
    expect(getDifficultyLevel("Avanzato")).toBe(5);
  });

  it("combines selected quick filters with AND semantics", () => {
    const easyLongEvent = event({ difficulty: "2", duration: "2 giorni" });
    const easyShortEvent = event({ difficulty: "2", duration: "4h" });
    const selectedFilters: QuickFilterType[] = ["easy", "weekendAway"];

    expect(matchesAllHomeQuickFilters(easyLongEvent, selectedFilters)).toBe(true);
    expect(matchesAllHomeQuickFilters(easyShortEvent, selectedFilters)).toBe(false);
  });

  it("does not treat multiple difficulty quick filters as OR", () => {
    const easyEvent = event({ difficulty: "2" });
    const selectedFilters: QuickFilterType[] = ["easy", "intermediate"];

    expect(matchesHomeQuickFilter(easyEvent, "easy")).toBe(true);
    expect(matchesAllHomeQuickFilters(easyEvent, selectedFilters)).toBe(false);
  });

  it("matches last spots only before the event is full", () => {
    expect(matchesHomeQuickFilter(event({ spots_total: 20, spots_taken: 13 }), "lastSpots")).toBe(false);
    expect(matchesHomeQuickFilter(event({ spots_total: 20, spots_taken: 14 }), "lastSpots")).toBe(true);
    expect(matchesHomeQuickFilter(event({ spots_total: 20, spots_taken: 17 }), "lastSpots")).toBe(true);
    expect(matchesHomeQuickFilter(event({ spots_total: 20, spots_taken: 20 }), "lastSpots")).toBe(false);
    expect(matchesHomeQuickFilter(event({ spots_total: 20, spots_taken: 17, status: "full" }), "lastSpots")).toBe(false);
  });
});
