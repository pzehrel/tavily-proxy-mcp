import { describe, expect, it, vi } from "vitest";
import { TavilyUsageClient } from "../../src/upstream/tavily-usage-client.js";

const usage = {
  key: {
    usage: 100,
    limit: 1000,
    search_usage: 70,
    extract_usage: 20,
    crawl_usage: 5,
    map_usage: 3,
    research_usage: 2,
  },
  account: {
    current_plan: "Researcher",
    plan_usage: 100,
    plan_limit: 1000,
    paygo_usage: 0,
    paygo_limit: 0,
    search_usage: 70,
    extract_usage: 20,
    crawl_usage: 5,
    map_usage: 3,
    research_usage: 2,
  },
};

describe("TavilyUsageClient", () => {
  it("queries usage with the selected key", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(usage), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await new TavilyUsageClient(fetchImpl).getUsage("tvly-selected");

    expect(result).toEqual(usage);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.tavily.com/usage",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer tvly-selected" },
      }),
    );
  });
});
