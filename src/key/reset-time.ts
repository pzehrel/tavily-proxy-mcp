export function nextEstimatedReset(now: Date, graceSeconds: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, graceSeconds));
}
