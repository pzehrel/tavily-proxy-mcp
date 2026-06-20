# tavily-proxy-mcp

一个本地 stdio MCP 代理。它连接 Tavily 官方 Streamable HTTP MCP，并在当前 API Key
额度耗尽后，按配置顺序惰性初始化并切换到下一个 Key。

## 工作方式

```text
Agent ──stdio──> tavily-proxy-mcp ──HTTP MCP──> mcp.tavily.com
                         │
                         └── 本地 Key 状态缓存
```

- Tavily 工具名称、描述、Schema 和返回结果由官方 MCP 动态提供。
- 同一时刻只初始化一个 Key，不会在启动时连接全部 Key。
- 正常请求始终使用当前 Key，不做轮询。
- 明确的额度耗尽、无效 Key 或短期限流会触发切换。
- 网络错误、5xx、参数错误和取消不会触发切换。
- 多个请求同时发现额度耗尽时，只会初始化一次下一个 Key。

## MCP 配置

发布后使用 `npx` 运行：

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

Key 按环境变量中的顺序使用。空白项会被忽略，重复 Key 会被去除。

## 环境变量

| 变量                         | 必填 | 默认值                        | 说明                               |
| ---------------------------- | ---: | ----------------------------- | ---------------------------------- |
| `TAVILY_API_KEYS`            |   是 | 无                            | 逗号分隔的 Tavily API Keys         |
| `TAVILY_MCP_URL`             |   否 | `https://mcp.tavily.com/mcp/` | 上游 Tavily MCP 地址               |
| `TAVILY_RESET_GRACE_SECONDS` |   否 | `900`                         | 月初预计重置时间的缓冲秒数         |
| `TAVILY_PROXY_LOG_LEVEL`     |   否 | `info`                        | `error`、`warn`、`info` 或 `debug` |

## Key 状态与重置

本地状态只保存 Key 的 SHA-256 指纹，不保存明文 Key。

默认状态文件位于 Node.js `os.tmpdir()` 返回的系统临时目录：

```text
<系统临时目录>/tavily-proxy-mcp-<用户ID>/state.json
```

例如 macOS 通常位于 `/var/folders/.../T/tavily-proxy-mcp-501/state.json`，Linux
通常位于 `/tmp/tavily-proxy-mcp-1000/state.json`。

临时目录可能在系统重启或清理任务运行时被删除。此时代理会丢失已耗尽 Key
的缓存状态，并从第一个 Key 重新尝试。

```text
standby → active → exhausted
                 → cooldown
                 → disabled
```

Tavily 官方说明月度额度在每月第一天重置，但 Usage API 当前不返回精确
`reset_at`。本项目按“下一个 UTC 月第一天 + 安全缓冲”估算恢复时间。到期后会调用
Tavily Usage API 验证额度，验证成功后才重新启用该 Key。

HTTP 429 会进一步区分：

- 明确的 rate limit：短时 `cooldown`。
- 明确的 credits/quota exhausted：等待月度重置。
- 含义不明确：查询 Usage API 消除歧义。

## 开发

项目使用 pnpm 管理依赖，需要 Node.js 22 或更高版本。

```bash
pnpm install
pnpm check
pnpm build
pnpm start
```

开发时可使用：

```bash
TAVILY_API_KEYS=tvly-your-key pnpm dev
```

质量门禁包含 ESLint、Prettier、TypeScript、Vitest 和生产构建。

## Git Hooks

安装依赖时，Husky 会自动配置 Git Hooks：

- `pre-commit`：运行 ESLint、Prettier 检查和 TypeScript 类型检查。
- `pre-push`：运行完整测试和生产构建。

也可以手动执行相同检查：

```bash
pnpm check:commit
pnpm check:push
pnpm check
```

## 发布

发布使用语义化版本和 `v` 前缀 Git Tag，例如 `v0.1.0`。

1. 更新 `package.json` 中的版本。
2. 将 `CHANGELOG.md` 的 `[Unreleased]` 内容整理到对应版本章节。
3. 提交并推送代码。
4. 创建并推送与版本一致的 Tag：

```bash
git tag v0.1.0
git push origin v0.1.0
```

Tag 会触发 GitHub Actions：

- 校验 Tag、package version 和 Changelog 一致。
- 运行完整质量门禁。
- 通过 npm Trusted Publishing 发布公开包并生成 provenance。
- 使用 Changelog 对应章节创建 GitHub Release。

首次发布前，需要在 npm 包的 Trusted Publisher 设置中授权：

```text
Repository: pzehrel/tavily-proxy-mcp
Workflow: release.yml
Environment: npm
```

由于 npm 需要先存在包页面才能配置 Trusted Publisher，首次发布需要手工 bootstrap：

```bash
npm login
npm whoami
pnpm check
npm publish --access public --provenance=false
```

完成首次发布后，在 npm 配置 Trusted Publisher，再推送 `v0.1.0` Tag。Release
工作流检测到 npm 已存在 `0.1.0` 后会跳过重复发布，但仍会创建 GitHub Release。
之后的新版本 Tag 会直接通过 OIDC 自动发布到 npm。

## 安全

- 不要将 API Key 提交到仓库。
- stdout 专用于 MCP 协议；日志只写入 stderr。
- 日志会脱敏 `tvly-` Key。
- 默认状态目录和常见环境文件已加入 `.gitignore`。

## 故障排查

### `TAVILY_API_KEYS must contain at least one key`

没有注入有效 Key。检查 MCP 客户端配置中的 `env`。

### 所有 Key 均不可用

错误会包含最早预计恢复时间。检查 Tavily Dashboard 中的额度与 Key 状态。

### 官方 MCP 不可达

网络错误不会使 Key 失效，也不会切换到下一个 Key。恢复网络后重试。

### 状态文件损坏

损坏文件会被重命名为 `state.json.corrupt-<timestamp>`，代理随后以空状态启动。

### 查看详细日志

设置：

```text
TAVILY_PROXY_LOG_LEVEL=debug
```

日志仍不会输出完整 API Key。

## License

MIT
