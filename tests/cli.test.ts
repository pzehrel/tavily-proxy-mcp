import { describe, expect, it, vi } from "vitest";

describe("CLI", () => {
  it("writes startup diagnostics to stderr", async () => {
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { main } = await import("../src/cli.js");

    await main();

    expect(write).toHaveBeenCalledWith("tavily-proxy-mcp starting\n");
  });
});
