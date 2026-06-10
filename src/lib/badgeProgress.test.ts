import { describe, expect, it } from "vitest";
import { getBadgeTarget, resolveBadgeProgress, type BadgeProgressRegistration } from "./badgeProgress";

const attended = (overrides: Partial<BadgeProgressRegistration>): BadgeProgressRegistration => ({
  id: crypto.randomUUID(),
  event_id: crypto.randomUUID(),
  status: "attended",
  checked_in: true,
  ...overrides,
});

describe("badge progress", () => {
  it("does not infer progress for locked special badges from total attendance", () => {
    const registrations = [
      attended({ event_id: "event-1" }),
      attended({ event_id: "event-2" }),
      attended({ event_id: "event-3" }),
    ];

    expect(
      resolveBadgeProgress({
        badge: { required_events: 1, category: "special", requirement_type: "events_attended" },
        registrations,
      })
    ).toBe(0);
  });

  it("counts only matching category events that pass event filters", () => {
    const registrations = [
      attended({
        event_id: "hard-trek",
        events: {
          id: "hard-trek",
          difficulty: "4",
          additional_fields: { fit_score_main_category: "Trekking & Outdoor" },
          event_categories: { name: "Trekking & Outdoor" },
        },
      }),
      attended({
        event_id: "easy-trek",
        events: {
          id: "easy-trek",
          difficulty: "2",
          additional_fields: { fit_score_main_category: "Trekking & Outdoor" },
          event_categories: { name: "Trekking & Outdoor" },
        },
      }),
      attended({
        event_id: "aperitivo",
        events: {
          id: "aperitivo",
          difficulty: null,
          additional_fields: { fit_score_main_category: "Social & Aperitivi" },
          event_categories: { name: "Social & Aperitivi" },
        },
      }),
    ];

    expect(
      resolveBadgeProgress({
        badge: {
          required_events: 3,
          category: "Trekking & Outdoor",
          requirement_type: "category_events",
          event_filters: { min_difficulty: 4 },
        },
        registrations,
      })
    ).toBe(1);
  });

  it("keeps generic attendance badge progress based on unique attended events", () => {
    const registrations = [
      attended({ event_id: "event-1" }),
      attended({ event_id: "event-1", created_at: "2026-06-10T12:00:00.000Z" }),
      attended({ event_id: "event-2" }),
    ];

    expect(
      resolveBadgeProgress({
        badge: { required_events: 5, category: null, requirement_type: "events_attended" },
        registrations,
      })
    ).toBe(2);
  });

  it("prefers stored user progress when the backend sends an in-progress badge row", () => {
    expect(
      resolveBadgeProgress({
        badge: { required_events: 10, category: null, requirement_type: "events_attended" },
        userBadge: { completed: false, progress: 7 },
        registrations: [],
      })
    ).toBe(7);
  });

  it("uses requirement value when required events are missing", () => {
    expect(getBadgeTarget({ requirement_value: 4 })).toBe(4);
  });
});
