# Codex-mem Notice

Codex-mem is a Codex-first port of [claude-mem](https://github.com/thedotmack/claude-mem) by Alex Newman ([@thedotmack](https://github.com/thedotmack)).

This repository preserves the upstream project's AGPL-3.0 license and builds directly on its architecture:

- Bun worker service
- SQLite and FTS5 storage
- MCP search tools
- session/observation/summary memory model

Codex-mem adds and reshapes the integration surface for Codex CLI, including:

- `notify` ingestion
- `codex exec --json` ingestion
- `codex app-server` ingestion
- `MEMORY.md` projections
- `bootstrap_memory`
- one-line Codex installer flow

Please see [LICENSE](/Users/nathanstone/Projects/codex%20mem/LICENSE) for license terms and the upstream project for original authorship and history.
