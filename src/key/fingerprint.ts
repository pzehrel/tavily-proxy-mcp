import { createHash } from "node:crypto";

export function fingerprintKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function shortFingerprint(fingerprint: string): string {
  return fingerprint.slice(0, 8);
}
