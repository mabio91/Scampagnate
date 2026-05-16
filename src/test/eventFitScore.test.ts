import { describe, expect, it } from "vitest";
import { calculateEventFitScore, getInterestScore, getLevelScore } from "@/hooks/useEventFitScore";

describe("event fit score helpers", () => {
  it("uses the best interest match across main and secondary categories", () => {
    const score = getInterestScore(
      ["mare_spiaggia", "aperitivi_cene"],
      ["Trekking giornalieri", "Mare e spiaggia"]
    );

    expect(score).toBe(100);
  });

  it("maps one level below to 60 and two or more below to 20", () => {
    expect(getLevelScore("intermediate", "4")).toBe(60);
    expect(getLevelScore("beginner", "4")).toBe(20);
  });

  it("returns null when the event has no valid difficulty", () => {
    expect(getLevelScore("advanced", null)).toBeNull();
    expect(getLevelScore("advanced", "")).toBeNull();
    expect(getLevelScore("advanced", "not-a-level")).toBeNull();
  });

  it("supports already-normalized labels in user interests", () => {
    const score = getInterestScore(
      ["Cammini plurigiornalieri", "Weekend fuori porta"],
      ["Trekking giornalieri"]
    );

    expect(score).toBe(75);
  });

  it("hides low interest-only scores at or below 30%", () => {
    const fitScore = calculateEventFitScore(
      { interests: ["aperitivi_cene", "giochi_sfide"] },
      {
        category: { name: "Trekking giornalieri" },
        secondaryCategories: [],
      }
    );

    expect(fitScore.interestOnly).toBe(true);
    expect(fitScore.score).toBeLessThanOrEqual(30);
    expect(fitScore.hidden).toBe(true);
  });

  it("shows interest-only scores above 30%", () => {
    const fitScore = calculateEventFitScore(
      { interests: ["Cammini plurigiornalieri", "giochi_sfide"] },
      {
        category: { name: "Trekking giornalieri" },
        secondaryCategories: [],
      }
    );

    expect(fitScore.interestOnly).toBe(true);
    expect(fitScore.score).toBeGreaterThan(30);
    expect(fitScore.hidden).toBe(false);
  });

  it("keeps low level-aware scores visible", () => {
    const fitScore = calculateEventFitScore(
      { interests: ["aperitivi_cene", "giochi_sfide"], self_level: "beginner" },
      {
        difficulty: "5",
        category: { name: "Trekking giornalieri" },
        secondaryCategories: [],
      }
    );

    expect(fitScore.interestOnly).toBe(false);
    expect(fitScore.score).toBeLessThanOrEqual(30);
    expect(fitScore.hidden).toBe(false);
  });
});
