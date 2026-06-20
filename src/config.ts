import { tmpdir } from "node:os";
import { join } from "node:path";

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface AppConfig {
  apiKeys: string[];
  mcpUrl: URL;
  statePath: string;
  resetGraceSeconds: number;
  logLevel: LogLevel;
}

const LOG_LEVELS: LogLevel[] = ["error", "warn", "info", "debug"];

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const apiKeys = [
    ...new Set(
      (env.TAVILY_API_KEYS ?? "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ];

  if (apiKeys.length === 0) {
    throw new Error("TAVILY_API_KEYS must contain at least one key");
  }

  const resetGraceSeconds = Number(env.TAVILY_RESET_GRACE_SECONDS ?? "900");
  if (!Number.isInteger(resetGraceSeconds) || resetGraceSeconds < 0) {
    throw new Error("TAVILY_RESET_GRACE_SECONDS must be a non-negative integer");
  }

  const logLevel = env.TAVILY_PROXY_LOG_LEVEL ?? "info";
  if (!LOG_LEVELS.includes(logLevel as LogLevel)) {
    throw new Error("TAVILY_PROXY_LOG_LEVEL must be error, warn, info, or debug");
  }

  return {
    apiKeys,
    mcpUrl: new URL(env.TAVILY_MCP_URL ?? "https://mcp.tavily.com/mcp/"),
    statePath: env.TAVILY_PROXY_STATE_PATH ?? defaultStatePath(),
    resetGraceSeconds,
    logLevel: logLevel as LogLevel,
  };
}

export function defaultStatePath(
  temporaryDirectory: string = tmpdir(),
  userId: string = typeof process.getuid === "function" ? String(process.getuid()) : "user",
): string {
  return join(temporaryDirectory, `tavily-proxy-mcp-${userId}`, "state.json");
}
