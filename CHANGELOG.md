# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Reorganized the README around installation, MCP configuration, runtime behavior, and
  troubleshooting.
- Clarified that the project is a tool-level proxy for Tavily's official MCP server.

## [0.1.0] - 2026-06-20

### Added

- Local stdio MCP bridge to Tavily's official Streamable HTTP MCP server.
- Dynamic Tavily tool discovery and invocation without hard-coded tool schemas.
- Lazy, ordered API Key failover after quota exhaustion, rate limits, or invalid keys.
- Temporary per-user state cache with monthly quota reset verification.
- Usage API checks for ambiguous HTTP 429 responses.
- Structured, redacted stderr logging.
- TypeScript, pnpm, ESLint, Prettier, Vitest, and Husky project infrastructure.
- GitHub Actions workflows for continuous integration and tagged releases.

[Unreleased]: https://github.com/pzehrel/tavily-proxy-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pzehrel/tavily-proxy-mcp/releases/tag/v0.1.0
