import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyState } from "../../src/key/state.js";
import { StateStore } from "../../src/key/state-store.js";

describe("StateStore", () => {
  it("writes and loads state atomically", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tavily-proxy-"));
    const path = join(directory, "state.json");
    const store = new StateStore(path);
    const state = emptyState();
    state.activeKeyId = "fingerprint";
    state.keys.fingerprint = { status: "active" };

    await store.save(state);

    expect(await store.load()).toEqual(state);
    expect(await readFile(path, "utf8")).not.toContain("tvly-");
  });

  it("recovers from malformed JSON", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tavily-proxy-"));
    const path = join(directory, "state.json");
    await writeFile(path, "{bad json", "utf8");

    const store = new StateStore(path, () => new Date("2026-06-19T00:00:00Z"));
    expect(await store.load()).toEqual(emptyState());
  });
});
