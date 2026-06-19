import type { LogLevel } from "./config.js";

const PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export interface Logger {
  error(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
}

const redact = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value.replace(/tvly-[A-Za-z0-9_-]+/g, "tvly-[redacted]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
  }
  return value;
};

export function createLogger(level: LogLevel): Logger {
  const write = (
    eventLevel: LogLevel,
    message: string,
    fields: Record<string, unknown> = {},
  ): void => {
    if (PRIORITY[eventLevel] > PRIORITY[level]) return;
    process.stderr.write(`${JSON.stringify(redact({ level: eventLevel, message, ...fields }))}\n`);
  };

  return {
    error: (message, fields) => write("error", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    info: (message, fields) => write("info", message, fields),
    debug: (message, fields) => write("debug", message, fields),
  };
}
