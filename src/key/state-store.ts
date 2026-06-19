import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { emptyState, type PersistedState } from "./state.js";

const keyStateSchema = z.object({
  status: z.enum(["standby", "active", "cooldown", "exhausted", "disabled"]),
  exhaustedAt: z.string().datetime().optional(),
  resetAt: z.string().datetime().optional(),
  cooldownUntil: z.string().datetime().optional(),
  lastErrorCode: z.string().optional(),
});

const stateSchema = z.object({
  version: z.literal(1),
  activeKeyId: z.string().optional(),
  generation: z.number().int().nonnegative(),
  keys: z.record(keyStateSchema),
});

export class StateStore {
  constructor(
    private readonly path: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async load(): Promise<PersistedState> {
    let text: string;
    try {
      text = await readFile(this.path, "utf8");
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") return emptyState();
      throw error;
    }

    try {
      return stateSchema.parse(JSON.parse(text));
    } catch {
      const backup = `${this.path}.corrupt-${this.now().toISOString().replaceAll(":", "-")}`;
      await rename(this.path, backup);
      return emptyState();
    }
  }

  async save(state: PersistedState): Promise<void> {
    const validated = stateSchema.parse(state);
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp-${process.pid}`;
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, this.path);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
