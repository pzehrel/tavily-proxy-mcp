import type { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";

export class ToolCache {
  private readonly entries = new Map<string, ListToolsResult>();

  get(cursor?: string): ListToolsResult | undefined {
    return this.entries.get(cursor ?? "__first__");
  }

  set(cursor: string | undefined, value: ListToolsResult): void {
    this.entries.set(cursor ?? "__first__", value);
  }

  clear(): void {
    this.entries.clear();
  }
}
