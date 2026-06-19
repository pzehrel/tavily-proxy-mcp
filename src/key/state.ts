export type KeyStatus = "standby" | "active" | "cooldown" | "exhausted" | "disabled";

export interface PersistedKeyState {
  status: KeyStatus;
  exhaustedAt?: string;
  resetAt?: string;
  cooldownUntil?: string;
  lastErrorCode?: string;
}

export interface PersistedState {
  version: 1;
  activeKeyId?: string;
  generation: number;
  keys: Record<string, PersistedKeyState>;
}

export function emptyState(): PersistedState {
  return { version: 1, generation: 0, keys: {} };
}
