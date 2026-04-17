import { describe, expect, it } from "vitest";
import { getInterestScore, getLevelScore } from "@/hooks/useEventFitScore";

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

  it("supports already-normalized labels in user interests", () => {
    const score = getInterestScore(
      ["Cammini plurigiornalieri", "Weekend fuori porta"],
      ["Trekking giornalieri"]
    );

    expect(score).toBe(75);
  });
});
