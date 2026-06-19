#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpBridge } from "./bridge/mcp-bridge.js";
import { loadConfig } from "./config.js";
import { KeyManager } from "./key/key-manager.js";
import { StateStore } from "./key/state-store.js";
import { createLogger } from "./logger.js";
import { TavilySessionFactory } from "./upstream/tavily-session-factory.js";
import { TavilyUsageClient } from "./upstream/tavily-usage-client.js";

export async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const logger = createLogger(config.logLevel);
  const stateStore = new StateStore(config.statePath);
  const usageClient = new TavilyUsageClient();
  const sessionFactory = new TavilySessionFactory(config.mcpUrl, logger);
  const keyManager = new KeyManager(
    config.apiKeys,
    stateStore,
    sessionFactory,
    usageClient,
    config.resetGraceSeconds,
    logger,
  );

  await keyManager.start();
  const bridge = new McpBridge(keyManager, logger);
  const transport = new StdioServerTransport();

  let closing = false;
  const close = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    logger.info("Stopping Tavily proxy MCP", { signal });
    await bridge.close().catch(() => undefined);
    await keyManager.close().catch(() => undefined);
  };

  process.once("SIGINT", () => void close("SIGINT"));
  process.once("SIGTERM", () => void close("SIGTERM"));

  await bridge.connect(transport);
  logger.info("Tavily proxy MCP running on stdio");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`tavily-proxy-mcp failed: ${message}\n`);
  process.exitCode = 1;
});
