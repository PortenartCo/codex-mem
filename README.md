<h1>Codex-mem</h1>

Persistent memory for Codex CLI, Claude Code, and MCP clients.

> Codex-mem is a Codex-first port of [claude-mem](https://github.com/thedotmack/claude-mem) by Alex Newman ([@thedotmack](https://github.com/thedotmack)). The upstream project got the core memory architecture right. This repo carries that work forward for Codex with official Codex integration surfaces, passive `MEMORY.md` recall, and one-line setup.

[NOTICE](NOTICE.md) explains the upstream credit and license continuity.

## Quick Start

### Codex CLI

```bash
npx codex-mem-cli@latest codex setup
```

After setup, start Codex normally:

```bash
codex
```

That one command:

- installs Bun, `uv`, and runtime dependencies if needed
- copies the runtime into a stable local install directory
- updates `~/.codex/config.toml` with `notify` and `[mcp_servers.codex_mem]`
- preserves and chains an existing `notify` command when it can do so safely
- starts the worker and verifies health before exiting

> npm note: the registry package is `codex-mem-cli` because `codex-mem` is already taken on npm. The GitHub project and installed CLI command are both `codex-mem`.

### Claude Code

Codex-mem still carries forward the upstream Claude Code integration model. If you want the original Claude plugin workflow, install upstream [claude-mem](https://github.com/thedotmack/claude-mem) or adapt the plugin assets in this repo to your Claude plugin environment.

### OpenClaw Gateway

Install the OpenClaw integration with:

```bash
curl -fsSL https://install.cmem.ai/openclaw.sh | bash
```

## Why It Exists

- Codex CLI can read MCP memory today, but write capture needs Codex-native ingestion surfaces.
- claude-mem already proved the worker, search, and progressive-recall model.
- Codex-mem adds `notify`, `codex exec --json`, and `codex app-server` capture so the same memory architecture works well in Codex.

## Key Features

- Persistent cross-session memory with SQLite, FTS5, and optional vector search
- Codex-native ingestion via `notify`, `exec --json`, and `app-server`
- Token-efficient recall through `bootstrap_memory`, `search`, `timeline`, and `get_observations`
- Root `MEMORY.md` projections for passive recall in Codex
- Web viewer on `http://localhost:37777`
- Privacy controls including `<private>` stripping before persistence

---

## Documentation

📚 **[View Full Documentation](https://docs.claude-mem.ai/)** - Browse on official website

### Getting Started

- **[Installation Guide](https://docs.claude-mem.ai/installation)** - Quick start & advanced installation
- **[Usage Guide](https://docs.claude-mem.ai/usage/getting-started)** - How Claude-Mem works automatically
- **[Search Tools](https://docs.claude-mem.ai/usage/search-tools)** - Query your project history with natural language
- **[Beta Features](https://docs.claude-mem.ai/beta-features)** - Try experimental features like Endless Mode

### Best Practices

- **[Context Engineering](https://docs.claude-mem.ai/context-engineering)** - AI agent context optimization principles
- **[Progressive Disclosure](https://docs.claude-mem.ai/progressive-disclosure)** - Philosophy behind Claude-Mem's context priming strategy

### Architecture

- **[Overview](https://docs.claude-mem.ai/architecture/overview)** - System components & data flow
- **[Architecture Evolution](https://docs.claude-mem.ai/architecture-evolution)** - The journey from v3 to v5
- **[Hooks Architecture](https://docs.claude-mem.ai/hooks-architecture)** - How Claude-Mem uses lifecycle hooks
- **[Hooks Reference](https://docs.claude-mem.ai/architecture/hooks)** - 7 hook scripts explained
- **[Worker Service](https://docs.claude-mem.ai/architecture/worker-service)** - HTTP API & Bun management
- **[Database](https://docs.claude-mem.ai/architecture/database)** - SQLite schema & FTS5 search
- **[Search Architecture](https://docs.claude-mem.ai/architecture/search-architecture)** - Hybrid search with Chroma vector database

### Configuration & Development

- **[Configuration](https://docs.claude-mem.ai/configuration)** - Environment variables & settings
- **[Development](https://docs.claude-mem.ai/development)** - Building, testing, contributing
- **[Troubleshooting](https://docs.claude-mem.ai/troubleshooting)** - Common issues & solutions

---

## How It Works

**Core Components:**

1. **5 Lifecycle Hooks** - SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd (6 hook scripts)
2. **Smart Install** - Cached dependency checker (pre-hook script, not a lifecycle hook)
3. **Worker Service** - HTTP API on port 37777 with web viewer UI and 10 search endpoints, managed by Bun
4. **SQLite Database** - Stores sessions, observations, summaries
5. **mem-search Skill** - Natural language queries with progressive disclosure
6. **Chroma Vector Database** - Hybrid semantic + keyword search for intelligent context retrieval

See [Architecture Overview](https://docs.claude-mem.ai/architecture/overview) for details.

---

## MCP Search Tools

Codex-mem provides intelligent memory search through **4 MCP tools** following a token-efficient **4-step workflow pattern**:

**The Workflow:**

1. **`bootstrap_memory`** - Build a compact memory brief for the current project/task
2. **`search`** - Get compact index with IDs (~50-100 tokens/result)
3. **`timeline`** - Get chronological context around interesting results
4. **`get_observations`** - Fetch full details ONLY for filtered IDs (~500-1,000 tokens/result)

**How It Works:**
- Claude and Codex can use MCP tools to search your memory
- Start with `bootstrap_memory` when resuming work in a new session
- Prefer passing `cwd` for repo-aware recall; `project` alone is a legacy fallback
- Start with `search` to get an index of results
- Use `timeline` to see what was happening around specific observations
- Use `get_observations` to fetch full details for relevant IDs
- **~10x token savings** by filtering before fetching details

**Available MCP Tools:**

1. **`bootstrap_memory`** - Compact project memory brief with follow-up observation IDs and repo-aware scoping via `cwd`/`repoRoot`
2. **`search`** - Search memory index with full-text queries, filters by type/date/project
3. **`timeline`** - Get chronological context around a specific observation or query
4. **`get_observations`** - Fetch full observation details by IDs (always batch multiple IDs)

**Example Usage:**

```typescript
// Step 1: Build a brief
bootstrap_memory(goal="resume auth refactor", cwd="/path/to/repo")

// Step 2: Search for index
search(query="authentication bug", type="bugfix", limit=10)

// Step 3: Review index, identify relevant IDs (e.g., #123, #456)

// Step 4: Fetch full details
get_observations(ids=[123, 456])
```

See [Search Tools Guide](https://docs.claude-mem.ai/usage/search-tools) for the upstream workflow background.

---

## Codex CLI

**Quick install for Codex CLI:**

```bash
npx codex-mem-cli@latest codex setup
```

That one command:

- copies the bundled runtime to `~/.claude-mem/codex`
- installs Bun, `uv`, and runtime dependencies if needed
- updates `~/.codex/config.toml` with `notify` plus `[mcp_servers.codex_mem]`
- preserves and chains an existing `notify` command when it is a standard string-array config
- starts the worker and verifies health on `http://127.0.0.1:37777`

**Health check after install:**

```bash
npx codex-mem-cli@latest codex doctor
```

After setup, keep using `codex` normally. The viewer stays available at `http://localhost:37777`.

**Manual / advanced setup:**

The worker now supports three Codex ingestion lanes:

1. `notify` for stock Codex CLI turn-complete capture
2. `exec --json` for CI / automation ingestion
3. `app-server` for higher-fidelity streamed events

**Safe MCP setup today (stdio transport):**

```toml
[mcp_servers.codex_mem]
command = "/ABS/PATH/TO/node"
args = ["/Users/YOU/.claude-mem/codex/scripts/mcp-server.cjs"]
enabled = true
required = false
```

**Codex notify example:**

```toml
notify = ["/ABS/PATH/TO/node", "/Users/YOU/.claude-mem/codex/scripts/codex-notify.js"]
```

**Automation / CI ingest example:**

```bash
codex exec --json "implement X" | node ~/.claude-mem/codex/scripts/bun-runner.js ~/.claude-mem/codex/scripts/worker-service.cjs codex exec-json
```

**Passive recall:**

- Enable `CLAUDE_MEM_MEMORY_MD_ENABLED=true` to keep a root `MEMORY.md` projection updated.
- Add `"MEMORY.md"` to Codex `project_doc_fallback_filenames` if you want Codex to load that projection automatically.

---

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Claude Code**: Latest version with plugin support
- **Bun**: JavaScript runtime and process manager (auto-installed if missing)
- **uv**: Python package manager for vector search (auto-installed if missing)
- **SQLite 3**: For persistent storage (bundled)

---
### Windows Setup Notes

If you see an error like:

```powershell
npm : The term 'npm' is not recognized as the name of a cmdlet
```

Make sure Node.js and npm are installed and added to your PATH. Download the latest Node.js installer from https://nodejs.org and restart your terminal after installation.

---

## Configuration

Settings are managed in `~/.claude-mem/settings.json` (auto-created with defaults on first run). That path is inherited from the upstream claude-mem architecture for compatibility.

See the **[Configuration Guide](https://docs.claude-mem.ai/configuration)** for all available settings and examples.

---

## Development

See the **[Development Guide](https://docs.claude-mem.ai/development)** for build instructions, testing, and contribution workflow.

---

## Publishing

The npm package name is `codex-mem-cli`.

For the first npm release of a new package, add an `NPM_TOKEN` repository secret and run the publish workflow on a `v*` tag.

After the package exists on npm, you can switch to npm trusted publishing for `KeystoneScience/codex-mem` and `.github/workflows/npm-publish.yml`, then remove `NPM_TOKEN`.

Manual publish still works:

```bash
npm adduser
npm publish --access public --provenance
```

---

## Troubleshooting

If experiencing issues, describe the problem to Claude and the troubleshoot skill will automatically diagnose and provide fixes.

See the **[Troubleshooting Guide](https://docs.claude-mem.ai/troubleshooting)** for common issues and solutions.

---

## Bug Reports

Create comprehensive bug reports with the automated generator:

```bash
cd ~/.claude/plugins/marketplaces/thedotmack
npm run bug-report
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Update documentation
5. Submit a Pull Request

See [Development Guide](https://docs.claude-mem.ai/development) for contribution workflow.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

Copyright (C) 2025 Alex Newman (@thedotmack). All rights reserved.

See the [LICENSE](LICENSE) file for full details.

**What This Means:**

- You can use, modify, and distribute this software freely
- If you modify and deploy on a network server, you must make your source code available
- Derivative works must also be licensed under AGPL-3.0
- There is NO WARRANTY for this software

**Note on Ragtime**: The `ragtime/` directory is licensed separately under the **PolyForm Noncommercial License 1.0.0**. See [ragtime/LICENSE](ragtime/LICENSE) for details.

---

## Support

- **Repository**: [github.com/KeystoneScience/codex-mem](https://github.com/KeystoneScience/codex-mem)
- **Issues**: [GitHub Issues](https://github.com/KeystoneScience/codex-mem/issues)
- **Upstream Project**: [github.com/thedotmack/claude-mem](https://github.com/thedotmack/claude-mem)
- **Credit**: Alex Newman ([@thedotmack](https://github.com/thedotmack)) for the original claude-mem architecture

---

**Built with Claude Agent SDK** | **Powered by Claude Code** | **Made with TypeScript**
