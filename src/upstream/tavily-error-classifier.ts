import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ErrorDisposition } from "./types.js";

export function classifyTavilyError(value: unknown): ErrorDisposition {
  const status = getStatus(value);
  const text = extractText(value).toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /\b(invalid|revoked|unauthorized|authentication)\b.*\b(api )?key\b/.test(text)
  ) {
    return { kind: "disabled", code: "invalid_key" };
  }

  if (
    /\b(credit|credits|quota|usage limit)\b.*\b(exhausted|exceeded|depleted|reached)\b/.test(
      text,
    ) ||
    /\b(exhausted|exceeded|depleted)\b.*\b(credit|credits|quota)\b/.test(text)
  ) {
    return { kind: "exhausted", code: "quota_exhausted" };
  }

  const retryAfter = getRetryAfter(value);
  if (
    (status === 429 && retryAfter !== undefined) ||
    text.includes("rate limit") ||
    text.includes("too many requests")
  ) {
    return {
      kind: "cooldown",
      code: "rate_limited",
      retryAfterSeconds: retryAfter ?? 60,
    };
  }

  if (status === 429) return { kind: "ambiguous-rate-limit", code: "http_429" };
  return { kind: "passthrough" };
}

export function isErrorToolResult(value: unknown): value is CallToolResult {
  return Boolean(value && typeof value === "object" && "isError" in value && value.isError);
}

function getStatus(value: unknown): number | undefined {
  if (value instanceof StreamableHTTPError) return value.code;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["status", "statusCode", "code"]) {
    const item = record[key];
    if (typeof item === "number") return item;
  }
  const response = record.response;
  if (response && typeof response === "object") {
    const item = (response as Record<string, unknown>).status;
    if (typeof item === "number") return item;
  }
  return undefined;
}

function getRetryAfter(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const direct = (value as Record<string, unknown>).retryAfterSeconds;
  if (typeof direct === "number") return direct;
  const text = extractText(value);
  const match = /retry after:?\s*(\d+)/i.exec(text);
  return match?.[1] ? Number(match[1]) : undefined;
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name} ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
