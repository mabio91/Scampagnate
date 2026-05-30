import { describe, expect, it } from "vitest";
import { resolveEventBadges } from "@/lib/eventBadges";

describe("resolveEventBadges", () => {
  it("keeps a custom badge visible when two manual badges are selected", () => {
    const badges = resolveEventBadges({
      price: 15,
      payment_type: "paid",
      spots_taken: 2,
      spots_total: 15,
      status: "open",
      access_rules: null,
      event_badges: ["evento_top", "consigliato", "Killer calories"],
    });

    expect(badges.map((badge) => badge.label)).toEqual(["Evento Top", "Killer calories"]);
  });

  it("does not replace automatic badges with a custom badge", () => {
    const badges = resolveEventBadges({
      price: 0,
      payment_type: "free",
      spots_taken: 9,
      spots_total: 10,
      status: "open",
      access_rules: { rules: [{ type: "founding_member" }] },
      event_badges: ["Killer calories"],
    });

    expect(badges.map((badge) => badge.key)).toEqual(["ultimi_posti", "founding_event"]);
  });
});
