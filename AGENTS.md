# Agent Guide for ollama-spacemolt-player

Purpose: help coding agents work safely and consistently in this repo.

## Repo Snapshot
- Runtime: Bun (TypeScript, ESM).
- UI: terminal UI via `blessed`.
- LLM: local Ollama HTTP API.
- Data: SQLite via `bun:sqlite` at `memory-{name}.sqlite`.
- Game client: SpaceMolt reference client is a git submodule in `client/`.

## Key Paths
- App entry: `src/index.ts` (orchestrates client + LLM + memory + TUI).
- LLM client: `src/ollama.ts`.
- Prompts: `src/prompt.ts`.
- Memory store: `src/memory.ts`.
- Actions validation: `src/actions.ts`.
- TUI: `src/tui.ts`.
- Config: `src/config.ts` (env-driven settings).

## Commands (Build / Lint / Test)
### Install
- `bun install`

### Run app
- `bun run ollama-play --name <instance-name>` (or `-n <instance-name>`)
- The `--name` argument is required and determines file paths:
  - Memory DB (includes credentials): `memory-{name}.sqlite`
- Example: `bun run ollama-play --name alice` uses `memory-alice.sqlite`
- Optional character overrides (new registrations only):
  - `--empire <empire>` or `-e` - Force empire: solarian, voidborn, crimson, nebula, outerrim
  - `--alignment <alignment>` or `-a` - Force alignment: lawful, good, neutral, chaotic, evil
  - `--personality <personality>` or `-p` - Force personality: cartographer, merchant, warrior, diplomat, pragmatist
- Example: `bun run ollama-play -n test-bot -e crimson -a evil -p warrior`

### Run in non-interactive mode (for testing/debugging)
- `bun run ollama-play --name <instance-name> --non-interactive [--max-ticks <number>]`
- Runs without the blessed TUI; output is written to log files instead.
- Example: `bun run ollama-play --name test-bot --non-interactive --max-ticks 100`

**Log files created:**
- `ui-{name}.log` - UI output with timestamps (game events, AI actions, state updates)
- `debug-{name}.log` - Debug information (full LLM prompts, raw responses, thinking)

**Flags:**
- `--non-interactive` - Enable headless mode (no TUI, output to log files)
- `--max-ticks <number>` - Stop after N game ticks (optional; runs indefinitely if not set)
- Logs are truncated on each run (fresh logs per execution)

### Reusing test accounts
- Prefer reusing the same instance names to avoid creating new accounts on every run.
- Credentials are stored in the instance SQLite DB and should not be committed.

**Known test instances:**
- `test-cli-override` -> `memory-test-cli-override.sqlite`

**Troubleshooting:**
- If you see `Invalid username or token`, delete the instance DB (`memory-{name}.sqlite`), then rerun to create a new account.

### Format
- `bun run biome:format`

### Lint
- `bun run biome:lint`

### Build
- No build script configured. If you add one, document it here.

### Tests
- Manual testing only (run the app and verify behavior).
- No test runner configured; single-test command is not available yet.
- If tests are added later, prefer a command that can target a file or test name.

## Environment / Config
- `OLLAMA_URL` (default: `http://localhost:11434`)
- `OLLAMA_MODEL` (default: `qwen3:8b`)
- `OLLAMA_TEMPERATURE` (number, default: `0.5`)
- `OLLAMA_THINKING` (boolean, default: `true` - enables thinking mode for Qwen3)
- `OLLAMA_TIMEOUT_MS` is not present; timeout is configured in `src/config.ts` as `ollamaTimeoutMs`.
- `SPACEMOLT_URL` (default: `wss://game.spacemolt.com/ws`)
- `DEBUG` (string, enable TUI prompt pane when `true`)
- `MEMORY_DB` (default: `memory-{name}.sqlite`)

## Cursor / Copilot Rules
- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot rules found in `.github/copilot-instructions.md`.

## Code Style Guidelines

### Language and Modules
- TypeScript, ESM (`"type": "module"` in `package.json`).
- Prefer `import type` for type-only imports.
- Use explicit exports and named exports when possible.

### Formatting
- Use Biome for formatting and linting.
- Keep formatting consistent with existing files (tabs for indent, semicolons, double quotes).
- Avoid manual reformatting; let Biome handle it.

### Imports
- Order: external modules first, then local modules.
- Keep import lists stable; do not reorder unless needed for clarity.
- Prefer `import type` to avoid runtime type imports.

### Naming Conventions
- Types/interfaces: `PascalCase`.
- Classes: `PascalCase`.
- Functions and variables: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE` for global constants; `camelCase` for local consts.
- File names: `lowercase` with `.ts`.

### Types and Strictness
- `strict` TypeScript is enabled. Avoid `any`.
- Use `unknown` then narrow or validate.
- Prefer explicit return types for public functions.
- Prefer `null` over `undefined` when a value is intentionally absent (matches current code style).

### Error Handling
- Use `try/catch` around external I/O (HTTP, file, DB).
- Throw typed errors where appropriate (see `OllamaTimeoutError`).
- Validate external inputs; return structured errors (see `validateAction`).
- Log errors with context and keep user-facing messaging concise.

### Side Effects and State
- Keep side effects in `src/index.ts`; helper modules should stay pure when possible.
- Avoid hidden global state; prefer explicit parameters.
- Use small, focused functions for validation and formatting.

### Prompts and LLM Outputs
- LLM calls must expect malformed output; parse defensively.
- Enforce JSON-only responses and validate fields before use.
- Keep prompt updates in `src/prompt.ts`.

### TUI
- Use `blessed` widgets and keep rendering in `src/tui.ts`.
- Avoid adding Unicode-heavy UI unless needed (TUI uses `fullUnicode: false`).

### SQLite / Memory
- Centralize DB operations in `src/memory.ts`.
- Serialize JSON using helper functions; guard against JSON stringify errors.
- Keep text fields reasonably bounded (see `MAX_TEXT`).

### Game Client
- Use the reference client from `client/`.
- Avoid changing `client/` unless the change is intended for the submodule.

## Editing Safety
- Do not edit `memory.sqlite` or `memory-*.sqlite`.
- Do not commit secrets or credentials.
- Keep changes minimal and aligned with the current architecture.

## Conventions in This Repo
- Use small, focused helpers for formatting and validation.
- Prefer explicit `if` branches to implicit coercion.
- Use early returns for invalid states.
- Maintain descriptive log messages for TUI output.

## When Adding New Features
- Update prompts and validation together.
- Add to memory tracking only if it improves LLM context.
- Keep tick timing aligned with server tick (10s; local uses 11s).

## If You Add Tests Later
- Document the test framework and single-test command here.
- Prefer a runner that supports file and name filtering.

## Quick Review Checklist
- `bun run biome:lint`
- `bun run biome:format`
- Manual run: `bun run ollama-play`
