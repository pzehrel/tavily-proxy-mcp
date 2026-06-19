import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Logger } from "../logger.js";
import { McpTavilySession } from "./tavily-session.js";
import type { TavilySession } from "./types.js";

export interface SessionFactory {
  create(apiKey: string, keyId: string, signal?: AbortSignal): Promise<TavilySession>;
}

export class TavilySessionFactory implements SessionFactory {
  constructor(
    private readonly mcpUrl: URL,
    private readonly logger: Logger,
  ) {}

  async create(apiKey: string, keyId: string, signal?: AbortSignal): Promise<TavilySession> {
    const holder: { session?: McpTavilySession } = {};
    const client = new Client(
      { name: "tavily-proxy-mcp", version: "0.1.0" },
      {
        capabilities: {},
        listChanged: {
          tools: {
            onChanged: (error) => {
              if (error) {
                this.logger.warn("Failed to refresh Tavily tools", {
                  keyId,
                  error: error.message,
                });
                return;
              }
              holder.session?.notifyToolsChanged();
            },
          },
        },
      },
    );
    const transport = new StreamableHTTPClientTransport(this.mcpUrl, {
      requestInit: {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    });

    this.logger.info("Initializing Tavily MCP session", { keyId });
    await client.connect(transport, signal ? { signal } : undefined);
    const session = new McpTavilySession(client);
    holder.session = session;
    this.logger.info("Tavily MCP session initialized", { keyId });
    return session;
  }
}
