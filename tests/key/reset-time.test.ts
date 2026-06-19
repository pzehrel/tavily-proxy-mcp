import { describe, expect, it } from "vitest";
import { nextEstimatedReset } from "../../src/key/reset-time.js";

describe("nextEstimatedReset", () => {
  it("uses the first day of the next UTC month plus grace", () => {
    expect(nextEstimatedReset(new Date("2026-06-19T08:00:00Z"), 900).toISOString()).toBe(
      "2026-07-01T00:15:00.000Z",
    );
  });
});
