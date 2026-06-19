import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { McpBridge } from "../../src/bridge/mcp-bridge.js";
import { KeyManager } from "../../src/key/key-manager.js";
import { StateStore } from "../../src/key/state-store.js";
import { TavilyUsageClient } from "../../src/upstream/tavily-usage-client.js";
import { FakeSessionFactory, silentLogger } from "../helpers/fakes.js";

describe("McpBridge", () => {
  it("proxies dynamic tools and retries once after quota exhaustion", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tavily-bridge-"));
    const factory = new FakeSessionFactory([
      {
        content: [{ type: "text", text: "Credit quota exhausted" }],
        isError: true,
      },
      {
        content: [{ type: "text", text: "from second key" }],
      },
    ]);
    const manager = new KeyManager(
      ["tvly-first", "tvly-second"],
      new StateStore(join(directory, "state.json")),
      factory,
      new TavilyUsageClient(),
      900,
      silentLogger,
    );
    await manager.start();

    const bridge = new McpBridge(manager, silentLogger);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" });

    await Promise.all([bridge.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    expect(tools.tools[0]?.name).toBe("tavily_search");
    expect(factory.created).toHaveLength(1);

    const result = await client.callTool({ name: "tavily_search", arguments: { query: "test" } });
    expect(result.content).toEqual([{ type: "text", text: "from second key" }]);
    expect(factory.created).toHaveLength(2);

    await client.close();
    await bridge.close();
    await manager.close();
  });
});
