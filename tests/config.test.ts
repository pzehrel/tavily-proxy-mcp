import { describe, expect, it } from "vitest";
import { defaultStatePath, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("rejects an empty key list", () => {
    expect(() => loadConfig({ TAVILY_API_KEYS: " , " })).toThrow(
      "TAVILY_API_KEYS must contain at least one key",
    );
  });

  it("trims and deduplicates keys while preserving order", () => {
    const config = loadConfig({ TAVILY_API_KEYS: " tvly-a, tvly-b,tvly-a " });
    expect(config.apiKeys).toEqual(["tvly-a", "tvly-b"]);
  });

  it("uses the operating system temporary directory", () => {
    expect(defaultStatePath("/private/tmp", "501")).toBe(
      "/private/tmp/tavily-proxy-mcp-501/state.json",
    );
  });
});
