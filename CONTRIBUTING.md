# Contributing

## Development

```bash
pnpm install
pnpm check
```

## Commit messages

Releases and `CHANGELOG.md` are generated automatically by Release Please. Use
[Conventional Commits](https://www.conventionalcommits.org/):

```text
fix: handle a recoverable upstream error
feat: add a new proxy capability
docs: clarify MCP configuration
feat!: change the environment variable format
```

Version selection follows commit intent:

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- `!` or `BREAKING CHANGE:` creates a major release.

After changes land on `main`, Release Please opens or updates a release pull request. Merging
that pull request updates `package.json` and `CHANGELOG.md`, creates the Git tag and GitHub
Release, and publishes the package to npm.
