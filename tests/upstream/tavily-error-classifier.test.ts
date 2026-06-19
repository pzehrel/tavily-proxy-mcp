import { describe, expect, it } from "vitest";
import { classifyTavilyError } from "../../src/upstream/tavily-error-classifier.js";

describe("classifyTavilyError", () => {
  it("classifies quota exhaustion", () => {
    expect(classifyTavilyError({ isError: true, content: "Credit quota exhausted" })).toEqual({
      kind: "exhausted",
      code: "quota_exhausted",
    });
  });

  it("classifies short rate limits", () => {
    expect(classifyTavilyError({ status: 429, message: "Rate limit. Retry after: 30" })).toEqual({
      kind: "cooldown",
      code: "rate_limited",
      retryAfterSeconds: 30,
    });
  });

  it("classifies tool-level rate limit messages without an HTTP status", () => {
    expect(classifyTavilyError({ isError: true, content: "Rate limit exceeded" })).toEqual({
      kind: "cooldown",
      code: "rate_limited",
      retryAfterSeconds: 60,
    });
  });

  it("does not switch for ordinary errors", () => {
    expect(classifyTavilyError({ message: "invalid query" })).toEqual({
      kind: "passthrough",
    });
  });
});
