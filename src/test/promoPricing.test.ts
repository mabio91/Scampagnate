import { describe, expect, it } from "vitest";
import {
  formatPromoCountdownLabel,
  formatPromoDateInput,
  getPromoBadgeLabel,
  getPromoWindowStatus,
  isWithinPromoWindow,
  promoDateInputToIso,
} from "@/lib/promoPricing";

describe("promo pricing helpers", () => {
  it("normalizes date input to Europe/Rome day boundaries", () => {
    expect(promoDateInputToIso("2026-01-10", "start")).toBe("2026-01-09T23:00:00.000Z");
    expect(promoDateInputToIso("2026-01-10", "end")).toBe("2026-01-10T22:59:59.999Z");
    expect(promoDateInputToIso("2026-07-10", "start")).toBe("2026-07-09T22:00:00.000Z");
    expect(promoDateInputToIso("2026-07-10", "end")).toBe("2026-07-10T21:59:59.999Z");
  });

  it("interprets local datetime values in the Rome timezone", () => {
    expect(promoDateInputToIso("2026-07-10T12:30", "end")).toBe("2026-07-10T10:30:00.000Z");
    expect(isWithinPromoWindow(null, "2026-07-10T12:30", new Date("2026-07-10T10:29:00.000Z"))).toBe(true);
    expect(getPromoWindowStatus(null, "2026-07-10T12:30", new Date("2026-07-10T10:31:00.000Z"))).toBe("expired");
  });

  it("keeps date-only promo end active until the end of the Rome day", () => {
    expect(isWithinPromoWindow(null, "2026-05-25", new Date("2026-05-25T21:30:00.000Z"))).toBe(true);
    expect(getPromoWindowStatus(null, "2026-05-25", new Date("2026-05-25T22:00:00.000Z"))).toBe("expired");
  });

  it("treats legacy UTC midnight promo ends as date-only admin input", () => {
    expect(isWithinPromoWindow(null, "2026-05-25T00:00:00+00:00", new Date("2026-05-25T21:30:00.000Z"))).toBe(true);
    expect(formatPromoDateInput("2026-05-25T00:00:00+00:00")).toBe("2026-05-25");
  });

  it("formats countdown labels without seconds", () => {
    const now = new Date("2026-05-25T08:00:00.000Z");

    expect(formatPromoCountdownLabel("2026-05-25T10:30:00.000Z", now)).toBe("scade tra 2h 30m");
    expect(formatPromoCountdownLabel("2026-05-26T10:30:00.000Z", now)).toBe("scade tra 1g 2h");
    expect(getPromoBadgeLabel("2026-05-25T10:30:00.000Z", now)).toBe("Promo · scade tra 2h 30m");
  });

  it("shows expired promo copy when the end has passed", () => {
    expect(formatPromoCountdownLabel("2026-05-25T10:30:00.000Z", new Date("2026-05-25T10:31:00.000Z"))).toBe("Promo scaduta");
    expect(getPromoBadgeLabel("2026-05-25T10:30:00.000Z", new Date("2026-05-25T10:31:00.000Z"))).toBe("Promo scaduta");
  });
});
