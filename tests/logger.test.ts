import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/logger.js";

describe("logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("redacts Tavily keys from logs", () => {
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    createLogger("debug").debug("request failed", {
      authorization: "Bearer tvly-secret-value",
    });

    const output = String(write.mock.calls[0]?.[0]);
    expect(output).not.toContain("tvly-secret-value");
    expect(output).toContain("tvly-[redacted]");
  });
});
