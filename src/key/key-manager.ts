import type { Logger } from "../logger.js";
import { classifyTavilyError } from "../upstream/tavily-error-classifier.js";
import type { SessionFactory } from "../upstream/tavily-session-factory.js";
import type { ErrorDisposition, TavilySession, TavilyUsage } from "../upstream/types.js";
import type { TavilyUsageClient } from "../upstream/tavily-usage-client.js";
import { fingerprintKey, shortFingerprint } from "./fingerprint.js";
import { nextEstimatedReset } from "./reset-time.js";
import type { PersistedKeyState, PersistedState } from "./state.js";
import type { StateStore } from "./state-store.js";

export interface ActiveLease {
  keyId: string;
  generation: number;
  session: TavilySession;
}

export class NoAvailableKeysError extends Error {
  constructor(readonly earliestRecovery?: string) {
    super(
      earliestRecovery
        ? `All Tavily API keys are unavailable; earliest estimated recovery is ${earliestRecovery}`
        : "All Tavily API keys are unavailable",
    );
  }
}

interface KeyRecord {
  key: string;
  id: string;
}

export class KeyManager {
  private state!: PersistedState;
  private lease?: ActiveLease;
  private switchQueue: Promise<void> = Promise.resolve();
  private readonly keys: KeyRecord[];

  constructor(
    apiKeys: string[],
    private readonly stateStore: StateStore,
    private readonly sessionFactory: SessionFactory,
    private readonly usageClient: TavilyUsageClient,
    private readonly resetGraceSeconds: number,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.keys = apiKeys.map((key) => ({ key, id: fingerprintKey(key) }));
  }

  async start(signal?: AbortSignal): Promise<ActiveLease> {
    this.state = await this.stateStore.load();
    await this.normalizeState();

    const preferred = this.state.activeKeyId;
    const ordered = preferred
      ? [
          ...this.keys.filter((item) => item.id === preferred),
          ...this.keys.filter((item) => item.id !== preferred),
        ]
      : this.keys;

    return this.activateFirstEligible(ordered, signal);
  }

  current(): ActiveLease {
    if (!this.lease) throw new Error("KeyManager has not been started");
    return this.lease;
  }

  async handleFailure(
    failedGeneration: number,
    disposition: ErrorDisposition,
    signal?: AbortSignal,
  ): Promise<ActiveLease> {
    let result: ActiveLease | undefined;
    let failure: unknown;

    const operation = this.switchQueue.then(async () => {
      if (this.lease && this.lease.generation !== failedGeneration) {
        result = this.lease;
        return;
      }
      try {
        result = await this.switchKey(disposition, signal);
      } catch (error: unknown) {
        failure = error;
      }
    });
    this.switchQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    await operation;

    if (failure) {
      throw failure instanceof Error ? failure : new Error(safeErrorMessage(failure));
    }
    if (!result) throw new Error("Key switch completed without an active key");
    return result;
  }

  async close(): Promise<void> {
    await this.lease?.session.close();
    this.lease = undefined;
  }

  private async switchKey(
    disposition: ErrorDisposition,
    signal?: AbortSignal,
  ): Promise<ActiveLease> {
    const oldLease = this.current();
    const resolvedDisposition =
      disposition.kind === "ambiguous-rate-limit"
        ? await this.resolveAmbiguousRateLimit(oldLease.keyId, signal)
        : disposition;
    const oldState = this.state.keys[oldLease.keyId] ?? { status: "active" };
    const updated = this.applyDisposition(oldState, resolvedDisposition);
    this.state.keys[oldLease.keyId] = updated;
    delete this.state.activeKeyId;
    await this.stateStore.save(this.state);

    this.logger.warn("Switching Tavily API key", {
      keyId: shortFingerprint(oldLease.keyId),
      reason: resolvedDisposition.kind,
    });

    const oldIndex = this.keys.findIndex((item) => item.id === oldLease.keyId);
    const candidates = [
      ...this.keys.slice(oldIndex + 1),
      ...this.keys.slice(0, Math.max(oldIndex, 0)),
    ];

    const next = await this.activateFirstEligible(candidates, signal);
    await oldLease.session.close().catch((error: unknown) => {
      this.logger.warn("Failed to close previous Tavily session", {
        keyId: shortFingerprint(oldLease.keyId),
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return next;
  }

  private async resolveAmbiguousRateLimit(
    keyId: string,
    signal?: AbortSignal,
  ): Promise<ErrorDisposition> {
    const record = this.keys.find((item) => item.id === keyId);
    if (!record) return { kind: "cooldown", code: "usage_key_missing", retryAfterSeconds: 60 };
    try {
      const usage = await this.usageClient.getUsage(record.key, signal);
      return hasAvailableUsage(usage)
        ? { kind: "cooldown", code: "rate_limited", retryAfterSeconds: 60 }
        : { kind: "exhausted", code: "quota_exhausted" };
    } catch {
      return { kind: "cooldown", code: "usage_check_failed", retryAfterSeconds: 60 };
    }
  }

  private applyDisposition(
    current: PersistedKeyState,
    disposition: ErrorDisposition,
  ): PersistedKeyState {
    const now = this.now();
    if (disposition.kind === "exhausted") {
      return {
        status: "exhausted",
        exhaustedAt: now.toISOString(),
        resetAt: nextEstimatedReset(now, this.resetGraceSeconds).toISOString(),
        lastErrorCode: disposition.code,
      };
    }
    if (disposition.kind === "disabled") {
      return { status: "disabled", lastErrorCode: disposition.code };
    }
    const retryAfterSeconds = disposition.kind === "cooldown" ? disposition.retryAfterSeconds : 60;
    const code = disposition.kind === "passthrough" ? "unexpected_passthrough" : disposition.code;
    return {
      ...current,
      status: "cooldown",
      cooldownUntil: new Date(now.getTime() + retryAfterSeconds * 1000).toISOString(),
      lastErrorCode: code,
    };
  }

  private async activateFirstEligible(
    candidates: KeyRecord[],
    signal?: AbortSignal,
  ): Promise<ActiveLease> {
    for (const candidate of candidates) {
      if (signal?.aborted) {
        throw signal.reason instanceof Error
          ? signal.reason
          : new Error(String(signal.reason ?? "Operation aborted"));
      }
      const keyState = this.state.keys[candidate.id] ?? { status: "standby" };
      if (!this.isEligible(keyState)) continue;

      if (keyState.status === "exhausted") continue;
      if (keyState.status === "cooldown") continue;

      try {
        const session = await this.sessionFactory.create(
          candidate.key,
          shortFingerprint(candidate.id),
          signal,
        );
        this.state.generation += 1;
        this.state.activeKeyId = candidate.id;
        this.state.keys[candidate.id] = { status: "active" };
        await this.stateStore.save(this.state);
        this.lease = {
          keyId: candidate.id,
          generation: this.state.generation,
          session,
        };
        return this.lease;
      } catch (error: unknown) {
        const disposition = classifyTavilyError(error);
        if (disposition.kind === "passthrough") throw error;
        this.logger.warn("Tavily MCP initialization failed", {
          keyId: shortFingerprint(candidate.id),
          error: error instanceof Error ? error.message : String(error),
        });
        this.state.keys[candidate.id] = this.applyDisposition(keyState, disposition);
        await this.stateStore.save(this.state);
      }
    }
    throw new NoAvailableKeysError(this.earliestRecovery());
  }

  private isEligible(state: PersistedKeyState): boolean {
    if (state.status === "disabled" || state.status === "exhausted") return false;
    if (state.status === "cooldown") {
      return Boolean(state.cooldownUntil && new Date(state.cooldownUntil) <= this.now());
    }
    return true;
  }

  private async normalizeState(): Promise<void> {
    const configured = new Set(this.keys.map((item) => item.id));
    this.state.keys = Object.fromEntries(
      Object.entries(this.state.keys).filter(([id]) => configured.has(id)),
    );

    for (const key of this.keys) {
      const current = this.state.keys[key.id];
      if (!current) {
        this.state.keys[key.id] = { status: "standby" };
        continue;
      }
      if (
        current.status === "exhausted" &&
        current.resetAt &&
        new Date(current.resetAt) <= this.now()
      ) {
        this.state.keys[key.id] = await this.verifyReset(key);
      } else if (
        current.status === "cooldown" &&
        current.cooldownUntil &&
        new Date(current.cooldownUntil) <= this.now()
      ) {
        this.state.keys[key.id] = { status: "standby" };
      }
    }
    await this.stateStore.save(this.state);
  }

  private async verifyReset(record: KeyRecord): Promise<PersistedKeyState> {
    try {
      const usage = await this.usageClient.getUsage(record.key);
      if (hasAvailableUsage(usage)) return { status: "standby" };
    } catch (error: unknown) {
      this.logger.warn("Could not verify Tavily quota reset", {
        keyId: shortFingerprint(record.id),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return {
      status: "exhausted",
      resetAt: new Date(this.now().getTime() + 60 * 60 * 1000).toISOString(),
      lastErrorCode: "reset_not_verified",
    };
  }

  private earliestRecovery(): string | undefined {
    return Object.values(this.state.keys)
      .flatMap((state) => [state.resetAt, state.cooldownUntil])
      .filter((value): value is string => Boolean(value))
      .sort()[0];
  }
}

function hasAvailableUsage(usage: TavilyUsage): boolean {
  const keyAvailable = usage.key.usage < usage.key.limit;
  const planAvailable = usage.account.plan_usage < usage.account.plan_limit;
  const paygoAvailable = usage.account.paygo_usage < usage.account.paygo_limit;
  return keyAvailable && (planAvailable || paygoAvailable);
}

function safeErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown key switch failure";
  }
}
