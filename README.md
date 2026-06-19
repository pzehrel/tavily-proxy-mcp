# tavily-proxy-mcp

本地 stdio MCP 代理，通过 Tavily 官方 Streamable HTTP MCP 提供工具，并支持 API Key
额度耗尽后的惰性切换。

## 使用

发布后通过 `npx` 启动 MCP：

```json
{
  "mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "tavily-proxy-mcp"],
      "env": {
        "TAVILY_API_KEYS": "tvly-key1,tvly-key2,tvly-key3"
      }
    }
  }
}
```

## 开发

```bash
pnpm install
pnpm check
pnpm build
pnpm start
```

项目使用 pnpm 管理依赖，但发布后的 MCP 由用户通过 `npx` 执行。需要 Node.js 22
或更高版本。
