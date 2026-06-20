# tavily-proxy-mcp

Tavily 官方 MCP 的多 API Key 工具代理。

它将 Tavily 上游提供的工具定义、参数和调用结果转发给 Agent，并负责管理多个 API
Key。当当前 Key 的额度耗尽、受到限流或失效时，代理会自动切换到下一个 Key，
无需修改 Agent 的提示词或工具调用方式。

## 快速开始

### 准备工作

- Node.js 22 或更高版本；
- 一个或多个 Tavily API Key。

不需要全局安装，MCP 客户端会通过 `npx` 自动下载和运行。

### 添加 MCP 配置

将下面的配置加入你的 MCP 客户端，并替换其中的 Key：

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

多个 Key 使用英文逗号分隔，并按填写顺序使用：

```text
tvly-key1 → tvly-key2 → tvly-key3
```

保存配置并重启 MCP 客户端后，即可像使用 Tavily 官方 MCP 一样使用搜索、抓取、
站点地图、爬取和研究等工具。

## 它是如何切换 Key 的

本工具不会轮询分摊请求，也不会在启动时初始化所有 Key。

1. 启动时只连接第一个可用 Key。
2. 正常请求持续使用当前 Key。
3. 当前 Key 明确额度耗尽、失效或受到限流时，才连接下一个 Key。
4. 导致切换的工具调用会在新 Key 上重试。
5. 多个请求同时遇到额度问题时，只会执行一次切换。

以下情况不会切换 Key：

- Tavily 服务端临时出现 5xx；
- 网络连接失败或超时；
- 工具参数错误；
- 用户取消调用。

## 与 Tavily 官方 MCP 的兼容性

工具列表和参数定义由 Tavily 官方 MCP 动态提供，本项目不写死具体工具。

这意味着 Tavily 修改工具描述、参数 Schema 或增加工具时，客户端可以通过代理获取
更新后的定义。代理只负责 stdio/HTTP 协议桥接、Key 管理和故障切换。

## 配置项

### `TAVILY_API_KEYS`

必填。逗号分隔的 Tavily API Key：

```text
TAVILY_API_KEYS=tvly-key1,tvly-key2,tvly-key3
```

首尾空白会被去除，重复 Key 会被忽略。

### `TAVILY_MCP_URL`

可选。默认连接：

```text
https://mcp.tavily.com/mcp/
```

通常不需要修改。

### `TAVILY_PROXY_LOG_LEVEL`

可选，默认值为 `info`。可选值：

```text
error
warn
info
debug
```

排查连接或切换问题时可以设为 `debug`。日志不会输出完整 API Key。

### `TAVILY_RESET_GRACE_SECONDS`

可选，默认值为 `900` 秒。

Tavily 说明月度额度在每月第一天重置，但 Usage API 不提供精确重置时刻。本工具会在
下个月 UTC 1 日 00:00 后等待该缓冲时间，再检查旧 Key 是否恢复额度。

## 状态缓存

代理需要记住当前 Key、已耗尽 Key 和预计恢复时间。状态文件存放在系统临时目录：

```text
<系统临时目录>/tavily-proxy-mcp-<用户ID>/state.json
```

例如：

```text
/tmp/tavily-proxy-mcp-1000/state.json
```

状态文件只保存 Key 的 SHA-256 指纹，不保存明文 Key。

临时目录被系统清理后，代理会从第一个 Key 重新检查和使用，不影响 Key 本身。

## 常见问题

### 提示 `TAVILY_API_KEYS must contain at least one key`

MCP 客户端没有成功注入 `TAVILY_API_KEYS`，或者变量内容为空。检查 JSON 配置以及
Key 之间是否使用英文逗号。

### 所有 Key 都不可用

检查 Tavily Dashboard 中各 Key 的有效性和账户剩余额度。错误信息会包含代理估算的
最早恢复时间。

### 为什么网络错误时不切换 Key

网络错误与 Key 额度无关。贸然切换并重试可能造成请求重复执行或重复计费，因此代理
只对明确的 Key 级错误进行切换。

### 为什么 HTTP 429 不一定代表月度额度耗尽

429 也可能只是短时速率限制。代理会检查错误内容；含义不明确时，会调用 Tavily
Usage API 判断应该短暂冷却还是等待月度重置。

### 如何查看详细日志

在 MCP 配置的 `env` 中加入：

```json
{
  "TAVILY_PROXY_LOG_LEVEL": "debug"
}
```

## 安全说明

- API Key 仅通过环境变量传入；
- 状态文件不保存明文 Key；
- 日志会脱敏 `tvly-` 格式的 Key；
- stdout 仅用于 MCP 协议，诊断日志写入 stderr；
- 不要把包含真实 Key 的 MCP 配置提交到公开仓库。

## 开发

项目使用 TypeScript 和 pnpm：

```bash
pnpm install
pnpm check
pnpm build
```

本地开发：

```bash
TAVILY_API_KEYS=tvly-your-key pnpm dev
```

版本变更见 [CHANGELOG.md](./CHANGELOG.md)。

## License

[MIT](./LICENSE)
