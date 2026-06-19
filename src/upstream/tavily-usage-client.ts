import { z } from "zod";
import type { TavilyUsage } from "./types.js";

const usageBucketSchema = z.object({
  usage: z.number(),
  limit: z.number(),
  search_usage: z.number(),
  extract_usage: z.number(),
  crawl_usage: z.number(),
  map_usage: z.number(),
  research_usage: z.number(),
});

const usageSchema = z.object({
  key: usageBucketSchema,
  account: z.object({
    current_plan: z.string(),
    plan_usage: z.number(),
    plan_limit: z.number(),
    paygo_usage: z.number(),
    paygo_limit: z.number(),
    search_usage: z.number(),
    extract_usage: z.number(),
    crawl_usage: z.number(),
    map_usage: z.number(),
    research_usage: z.number(),
  }),
});

export class TavilyUsageClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getUsage(apiKey: string, signal?: AbortSignal): Promise<TavilyUsage> {
    const response = await this.fetchImpl("https://api.tavily.com/usage", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      throw new Error(`Tavily usage request failed with HTTP ${response.status}`);
    }

    return usageSchema.parse(await response.json());
  }
}
