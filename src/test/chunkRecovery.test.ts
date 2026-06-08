import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "@/lib/chunkRecovery";

describe("chunkRecovery", () => {
  it("recognizes dynamic import failures from stale lazy chunks", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Loading chunk 12 failed."))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error("network hiccup"), { name: "ChunkLoadError" }))).toBe(true);
  });

  it("ignores unrelated runtime errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError("plain validation error")).toBe(false);
  });
});
