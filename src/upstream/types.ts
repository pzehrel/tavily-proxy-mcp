import type {
  CallToolResult,
  Implementation,
  ListToolsResult,
  ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";

export interface TavilyUsage {
  key: {
    usage: number;
    limit: number;
    search_usage: number;
    extract_usage: number;
    crawl_usage: number;
    map_usage: number;
    research_usage: number;
  };
  account: {
    current_plan: string;
    plan_usage: number;
    plan_limit: number;
    paygo_usage: number;
    paygo_limit: number;
    search_usage: number;
    extract_usage: number;
    crawl_usage: number;
    map_usage: number;
    research_usage: number;
  };
}

export type ErrorDisposition =
  | { kind: "exhausted"; code: string }
  | { kind: "cooldown"; code: string; retryAfterSeconds: number }
  | { kind: "disabled"; code: string }
  | { kind: "ambiguous-rate-limit"; code: string }
  | { kind: "passthrough" };

export interface TavilySessionInfo {
  serverInfo?: Implementation;
  capabilities?: ServerCapabilities;
  instructions?: string;
}

export interface ToolProgress {
  progress: number;
  total?: number;
  message?: string;
}

export interface CallToolOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ToolProgress) => void;
}

export interface TavilySession {
  readonly info: TavilySessionInfo;
  listTools(cursor?: string): Promise<ListToolsResult>;
  callTool(
    request: { name: string; arguments?: Record<string, unknown> },
    options?: CallToolOptions,
  ): Promise<CallToolResult>;
  onToolsChanged(listener: () => void): void;
  close(): Promise<void>;
}
