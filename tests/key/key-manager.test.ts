import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprintKey } from "../../src/key/fingerprint.js";
import { KeyManager } from "../../src/key/key-manager.js";
import { StateStore } from "../../src/key/state-store.js";
import { TavilyUsageClient } from "../../src/upstream/tavily-usage-client.js";
import type { SessionFactory } from "../../src/upstream/tavily-session-factory.js";
import { FakeSessionFactory, silentLogger } from "../helpers/fakes.js";

describe("KeyManager", () => {
  it("initializes only the first key until failover", async () => {
    const factory = new FakeSessionFactory();
    const manager = await createManager(factory);

    const first = await manager.start();
    expect(first.keyId).toBe(fingerprintKey("tvly-first"));
    expect(factory.created).toHaveLength(1);

    const second = await manager.handleFailure(first.generation, {
      kind: "exhausted",
      code: "quota_exhausted",
    });

    expect(second.keyId).toBe(fingerprintKey("tvly-second"));
    expect(factory.created).toHaveLength(2);
  });

  it("performs one switch for concurrent failures", async () => {
    const factory = new FakeSessionFactory();
    const manager = await createManager(factory);
    const first = await manager.start();

    const leases = await Promise.all(
      Array.from({ length: 10 }, () =>
        manager.handleFailure(first.generation, {
          kind: "exhausted",
          code: "quota_exhausted",
        }),
      ),
    );

    expect(new Set(leases.map((lease) => lease.generation)).size).toBe(1);
    expect(factory.created).toHaveLength(2);
  });

  it("does not rotate keys for an upstream network failure", async () => {
    const factory: SessionFactory = {
      create: async () => {
        throw new Error("fetch failed");
      },
    };
    const directory = await mkdtemp(join(tmpdir(), "tavily-manager-"));
    const manager = new KeyManager(
      ["tvly-first", "tvly-second"],
      new StateStore(join(directory, "state.json")),
      factory,
      new TavilyUsageClient(),
      900,
      silentLogger,
    );

    await expect(manager.start()).rejects.toThrow("fetch failed");
  });
});

async function createManager(factory: FakeSessionFactory): Promise<KeyManager> {
  const directory = await mkdtemp(join(tmpdir(), "tavily-manager-"));
  return new KeyManager(
    ["tvly-first", "tvly-second"],
    new StateStore(join(directory, "state.json")),
    factory,
    new TavilyUsageClient(),
    900,
    silentLogger,
    () => new Date("2026-06-19T08:00:00Z"),
  );
}
