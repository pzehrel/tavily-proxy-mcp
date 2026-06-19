import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolOptions, TavilySession, TavilySessionInfo, ToolProgress } from "./types.js";

export class McpTavilySession implements TavilySession {
  readonly info: TavilySessionInfo;
  private toolsChangedListener: () => void = () => undefined;

  constructor(private readonly client: Client) {
    this.info = {
      ...(client.getServerVersion() ? { serverInfo: client.getServerVersion() } : {}),
      ...(client.getServerCapabilities() ? { capabilities: client.getServerCapabilities() } : {}),
      ...(client.getInstructions() ? { instructions: client.getInstructions() } : {}),
    };
  }

  listTools(cursor?: string) {
    return this.client.listTools(cursor ? { cursor } : undefined);
  }

  async callTool(
    request: { name: string; arguments?: Record<string, unknown> },
    options: CallToolOptions = {},
  ): Promise<CallToolResult> {
    const result = await this.client.callTool(request, CallToolResultSchema, {
      resetTimeoutOnProgress: true,
      maxTotalTimeout: 15 * 60 * 1000,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.onProgress
        ? { onprogress: (progress: ToolProgress) => options.onProgress?.(progress) }
        : {}),
    });
    return CallToolResultSchema.parse(result);
  }

  onToolsChanged(listener: () => void): void {
    this.toolsChangedListener = listener;
  }

  notifyToolsChanged(): void {
    this.toolsChangedListener();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
