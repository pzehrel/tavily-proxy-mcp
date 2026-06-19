#!/usr/bin/env node

export async function main(): Promise<void> {
  process.stderr.write("tavily-proxy-mcp starting\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`tavily-proxy-mcp failed: ${message}\n`);
  process.exitCode = 1;
});
