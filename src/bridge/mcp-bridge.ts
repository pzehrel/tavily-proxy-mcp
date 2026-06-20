import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import type { KeyManager } from "../key/key-manager.js";
import type { Logger } from "../logger.js";
import { packageMetadata } from "../package-metadata.js";
import { classifyTavilyError, isErrorToolResult } from "../upstream/tavily-error-classifier.js";
import type { ErrorDisposition } from "../upstream/types.js";
import { ToolCache } from "./tool-cache.js";

export class McpBridge {
  private readonly server: Server;
  private readonly cache = new ToolCache();

  constructor(
    private readonly keyManager: KeyManager,
    private readonly logger: Logger,
  ) {
    const upstream = keyManager.current().session.info;
    this.server = new Server(packageMetadata, {
      capabilities: mapCapabilities(upstream.capabilities),
      ...(upstream.instructions ? { instructions: upstream.instructions } : {}),
    });
    this.registerHandlers();
    this.bindToolsChanged();
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      const cursor = request.params?.cursor;
      const cached = this.cache.get(cursor);
      if (cached) return cached;
      const result = await this.keyManager.current().session.listTools(cursor);
      this.cache.set(cursor, result);
      return result;
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      let lease = this.keyManager.current();
      const attempted = new Set<number>();

      while (!attempted.has(lease.generation)) {
        attempted.add(lease.generation);
        try {
          const result = await lease.session.callTool(
            {
              name: request.params.name,
              ...(request.params.arguments ? { arguments: request.params.arguments } : {}),
            },
            {
              signal: extra.signal,
              onProgress: (progress) => {
                if (extra._meta?.progressToken === undefined) return;
                void extra
                  .sendNotification({
                    method: "notifications/progress",
                    params: {
                      progressToken: extra._meta.progressToken,
                      progress: progress.progress,
                      ...(progress.total === undefined ? {} : { total: progress.total }),
                      ...(progress.message === undefined ? {} : { message: progress.message }),
                    },
                  })
                  .catch((error: unknown) => {
                    this.logger.debug("Failed to forward tool progress", {
                      error: error instanceof Error ? error.message : "Unknown progress error",
                    });
                  });
              },
            },
          );

          const disposition = isErrorToolResult(result)
            ? classifyTavilyError(result)
            : ({ kind: "passthrough" } as const);
          if (disposition.kind === "passthrough") return result;
          lease = await this.failover(lease.generation, disposition, extra.signal);
        } catch (error: unknown) {
          if (extra.signal.aborted) throw error;
          const disposition = classifyTavilyError(error);
          if (disposition.kind === "passthrough") throw error;
          lease = await this.failover(lease.generation, disposition, extra.signal);
        }
      }

      return {
        content: [{ type: "text", text: "All Tavily API keys failed for this request." }],
        isError: true,
      } satisfies CallToolResult;
    });
  }

  private async failover(
    generation: number,
    disposition: Exclude<ErrorDisposition, { kind: "passthrough" }>,
    signal: AbortSignal,
  ) {
    const lease = await this.keyManager.handleFailure(generation, disposition, signal);
    this.cache.clear();
    this.bindToolsChanged();
    return lease;
  }

  private bindToolsChanged(): void {
    this.keyManager.current().session.onToolsChanged(() => {
      this.cache.clear();
      void this.server.sendToolListChanged().catch((error: unknown) => {
        this.logger.warn("Failed to notify downstream tool list change", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });
  }
}

function mapCapabilities(upstream?: ServerCapabilities): ServerCapabilities {
  return {
    tools: {
      listChanged: upstream?.tools?.listChanged === true,
    },
  };
}
