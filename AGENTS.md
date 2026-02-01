# Agent Guide for ollama-spacemolt-player

Help coding agents work safely and consistently in this repo.

## Important References

**Game Server WebSocket API**: https://www.spacemolt.com/api.md

The `client/` folder in the root is a reference client that includes the library used to connect to the game server.

When testing, **reuse existing accounts** when possible. Memory DB files (`memory-*.sqlite`) are in the root and git-ignored. Examples: `memory-test-cli-override.sqlite`, `memory-swarm-01.sqlite`.

## Repo Snapshot

- **Runtime**: Bun (TypeScript, ESM)
- **UI**: Terminal UI via `blessed`
- **LLM**: Local Ollama HTTP API
- **Data**: SQLite via `bun:sqlite` at `memory-{name}.sqlite`
- **Game client**: SpaceMolt reference client (git submodule in `client/`)

## Key Paths

- `src/index.ts` - Main entry (orchestrates client + LLM + memory + output)
- `src/config.ts` - Configuration and CLI args parsing
- `src/ollama.ts` - Ollama HTTP client
- `src/memory.ts` - SQLite memory store
- `src/prompt.ts` - LLM prompt building
- `src/actions.ts` - Action validation and dispatch
- `src/game-state.ts` - Game state tracking
- `src/registration.ts` - Registration flow
- `src/output/tui-output.ts` - Interactive TUI output
- `src/output/file-logger-output.ts` - Headless log output
- `src/output-interface.ts` - Output interface definition
- `src/swarm.ts` - Swarm orchestrator for multiple bots
- `src/tui/` - TUI components (layout, formatters, colors, utils)
- `src/types.ts` - Type definitions
- `src/utils.ts` - Shared utilities
- `src/constants.ts` - Constants

## Commands

### Install
```bash
bun install
```

### Run Single Bot (Interactive)
```bash
bun run ollama-play --name <instance-name>
```

Required:
- `--name` or `-n`: Instance name (determines DB: `memory-{name}.sqlite`)

Optional character overrides (new registrations only):
- `--empire` or `-e`: solarian, voidborn, crimson, nebula, outerrim
- `--alignment` or `-a`: lawful, good, neutral, chaotic, evil
- `--personality` or `-p`: cartographer, merchant, warrior, diplomat, pragmatist
- `--speech-style` or `-s`: mythic, punny, gritty, scholarly

Examples:
```bash
bun run ollama-play -n alice
bun run ollama-play -n test-bot -e crimson -a evil -p warrior
```

### Run Non-Interactive (Headless)
```bash
bun run ollama-play --name <instance-name> --non-interactive [--max-ticks <number>]
```

Output:
- `ui-{name}.log` - UI output with timestamps
- `debug-{name}.log` - Debug info (prompts, responses, thinking)

Example:
```bash
bun run ollama-play --name test-bot --non-interactive --max-ticks 100
```

### Run Swarm
```bash
bun run swarm [--count 5] [--prefix swarm] [--empire <empire>] [--alignment <alignment>] [--personality <personality>] [--speech-style <style>]
```

Defaults:
- Count: 5
- Prefix: swarm (creates swarm-01, swarm-02, etc.)
- Model: ministral-3:8b
- Thinking: false

Example:
```bash
bun run swarm --count 10 --empire crimson --alignment evil --personality warrior
```

### Format and Lint
```bash
bun run biome:format
bun run biome:lint
```

### Testing

Manual testing only. No test runner configured.

Prefer reusing existing accounts:
- `test-cli-override` → `memory-test-cli-override.sqlite`
- `test-bot-1` → `memory-test-bot-1.sqlite`
- `swarm-01` through `swarm-05` → `memory-swarm-*.sqlite`

If you see `Invalid username or token`, delete the instance DB and rerun.

## Environment Variables

- `OLLAMA_URL` - Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `qwen3:8b`)
- `OLLAMA_TEMPERATURE` - Temperature (default: `0.5`)
- `OLLAMA_THINKING` - Enable thinking mode (default: `true`)
- `SPACEMOLT_URL` - Game WebSocket URL (default: `wss://game.spacemolt.com/ws`)
- `DEBUG` - Enable TUI prompt pane (default: `false`)
- `MEMORY_DB` - Override DB path (default: `memory-{name}.sqlite`)

Timeout is configured in `src/config.ts` as `ollamaTimeoutMs` (60000ms).

## Code Style Guidelines

### Formatting
- Use Biome for formatting and linting
- Let Biome handle formatting; avoid manual changes

### Naming Conventions
- Types/interfaces: `PascalCase`
- Classes: `PascalCase`
- Functions and variables: `camelCase`
- Global constants: `SCREAMING_SNAKE_CASE`
- Local constants: `camelCase`
- File names: `lowercase` with `.ts`

### Types and Strictness
- `strict` TypeScript enabled; avoid `any`
- Use `unknown` then narrow or validate
- Prefer explicit return types for public functions
- Prefer `null` over `undefined` for intentionally absent values

### Error Handling
- Use `try/catch` around external I/O (HTTP, file, DB)
- Throw typed errors where appropriate (e.g., `OllamaTimeoutError`)
- Validate external inputs; return structured errors (e.g., `validateAction`)
- Log errors with context; keep user-facing messages concise

### Side Effects and State
- Keep side effects in `src/index.ts`; helper modules should be pure
- Avoid hidden global state; prefer explicit parameters
- Use small, focused functions for validation and formatting

### Prompts and LLM Outputs
- LLM calls must expect malformed output; parse defensively
- Enforce JSON-only responses and validate fields before use
- Keep prompt updates in `src/prompt.ts`

### TUI
- TUI is now in `src/output/tui-output.ts` and `src/tui/` directory
- Use `blessed` widgets; keep rendering in output modules
- Avoid Unicode-heavy UI unless needed (uses `fullUnicode: false`)

### SQLite / Memory
- Centralize DB operations in `src/memory.ts`
- Serialize JSON using helper functions; guard against stringify errors
- Keep text fields reasonably bounded

### Game Client
- Use the reference client from `client/` submodule
- Do not modify `client/` unless the change is intended for upstream

## Editing Safety

- Do not edit or commit `memory-*.sqlite` files
- Do not commit secrets or credentials
- Keep changes minimal and aligned with current architecture
- All DB files and logs are git-ignored

## Conventions in This Repo

- Use small, focused helpers for formatting and validation
- Prefer explicit `if` branches over implicit coercion
- Use early returns for invalid states
- Maintain descriptive log messages for output

## When Adding New Features

- Update prompts and validation together
- Add to memory tracking only if it improves LLM context
- Keep tick timing aligned with server tick (10s; local uses 11s)
- Update both `src/output/tui-output.ts` and `src/output/file-logger-output.ts` for UI changes

## If You Add Tests Later

- Document the test framework and single-test command here
- Prefer a runner that supports file and name filtering

## Quick Review Checklist

```bash
bun run biome:lint
bun run biome:format
bun run ollama-play --name test-bot --non-interactive --max-ticks 10
```
