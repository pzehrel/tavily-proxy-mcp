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

  it("uses the standard macOS application support directory", () => {
    expect(defaultStatePath({}, "darwin", "/Users/test")).toBe(
      "/Users/test/Library/Application Support/tavily-proxy-mcp/state.json",
    );
  });

  it("respects XDG_STATE_HOME on Linux", () => {
    expect(defaultStatePath({ XDG_STATE_HOME: "/state" }, "linux", "/home/test")).toBe(
      "/state/tavily-proxy-mcp/state.json",
    );
  });

  it("uses LOCALAPPDATA on Windows", () => {
    expect(defaultStatePath({ LOCALAPPDATA: "C:\\Local" }, "win32", "C:\\Users\\test")).toContain(
      "tavily-proxy-mcp",
    );
  });
});
