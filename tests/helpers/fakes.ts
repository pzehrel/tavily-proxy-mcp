import type { CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "../../src/logger.js";
import type { SessionFactory } from "../../src/upstream/tavily-session-factory.js";
import type { TavilySession, TavilySessionInfo } from "../../src/upstream/types.js";

export const silentLogger: Logger = {
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  debug: () => undefined,
};

export class FakeSession implements TavilySession {
  readonly info: TavilySessionInfo = {
    capabilities: { tools: { listChanged: true } },
  };
  closed = false;
  private listener: () => void = () => undefined;

  constructor(
    private readonly result: CallToolResult = {
      content: [{ type: "text", text: "ok" }],
    },
  ) {}

  async listTools(): Promise<ListToolsResult> {
    return {
      tools: [
        {
          name: "tavily_search",
          description: "Search",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    };
  }

  async callTool(): Promise<CallToolResult> {
    return this.result;
  }

  onToolsChanged(listener: () => void): void {
    this.listener = listener;
  }

  emitToolsChanged(): void {
    this.listener();
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

export class FakeSessionFactory implements SessionFactory {
  readonly created: string[] = [];
  readonly sessions: FakeSession[] = [];

  constructor(private readonly results: CallToolResult[] = []) {}

  async create(_apiKey: string, keyId: string): Promise<TavilySession> {
    this.created.push(keyId);
    const session = new FakeSession(
      this.results[this.sessions.length] ?? {
        content: [{ type: "text", text: "ok" }],
      },
    );
    this.sessions.push(session);
    return session;
  }
}
