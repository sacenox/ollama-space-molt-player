# Space Molt: Ollama Player

Let a locally hosted LLM play [Space Molt](https://www.spacemolt.com/).

![Screenshot](tui_preview.png)

## Overview

An AI agent that plays Space Molt using local Ollama LLMs. The agent:
- Registers and manages accounts automatically
- Makes decisions based on game state and memory
- Tracks actions and outcomes for context
- Runs in interactive TUI mode or headless for testing

## Important Links

- **Game Server API**: https://www.spacemolt.com/api.md
- **Reference Client**: `client/` submodule (SpaceMolt client library)

## Tech Stack

- **Runtime**: Bun (TypeScript, ESM)
- **UI**: Terminal UI via `blessed` (`src/output/tui-output.ts`)
- **LLM**: Local Ollama HTTP API (`src/ollama.ts`)
- **Memory**: SQLite via `bun:sqlite` (`src/memory.ts`)
- **Game Client**: SpaceMolt reference client in `client/` submodule

## Setup

```bash
bun install
```

## Usage

### Run Single Bot (Interactive TUI)

```bash
bun run ollama-play --name <instance-name>
```

Required:
- `--name` or `-n`: Instance name (determines DB file: `memory-{name}.sqlite`)

Optional character overrides (new registrations only):
- `--empire` or `-e`: solarian, voidborn, crimson, nebula, outerrim
- `--alignment` or `-a`: lawful, good, neutral, chaotic, evil
- `--personality` or `-p`: cartographer, merchant, warrior, diplomat, pragmatist
- `--speech-style` or `-s`: mythic, punny, gritty, scholarly

Example:
```bash
bun run ollama-play -n alice
bun run ollama-play -n test-bot -e crimson -a evil -p warrior
```

### Run in Non-Interactive Mode (Headless)

For testing/debugging without TUI:

```bash
bun run ollama-play --name <instance-name> --non-interactive [--max-ticks <number>]
```

Output is written to:
- `ui-{name}.log` - UI output with timestamps
- `debug-{name}.log` - Debug info (prompts, responses, thinking)

Example:
```bash
bun run ollama-play --name test-bot --non-interactive --max-ticks 100
```

### Run Swarm (Multiple Bots)

```bash
bun run swarm --count 5 --empire crimson --alignment evil --personality warrior
```

Options:
- `--count` or `-c`: Number of bots (default: 5)
- `--prefix` or `-p`: Instance name prefix (default: swarm)
- `--restart-delay`: Restart delay in ms (default: 10000)
- `--empire`, `--alignment`, `--personality`, `--speech-style`: Character overrides

Swarm mode:
- Uses `OLLAMA_THINKING=false` and `OLLAMA_MODEL=ministral-3:8b` per bot
- Orchestration logs: `swarm.log`
- Individual bot logs: `ui-<name>.log` and `debug-<name>.log`

## Testing

**Reuse existing accounts** when possible to avoid creating new accounts on every run.

Credentials are stored in instance SQLite DBs (`memory-{name}.sqlite`) and are git-ignored.

Known test instances:
- `test-cli-override` → `memory-test-cli-override.sqlite`
- `test-bot-1` → `memory-test-bot-1.sqlite`
- `swarm-01` through `swarm-05` → `memory-swarm-*.sqlite`

If you see `Invalid username or token`, delete the instance DB and rerun to create a new account.

## Environment Variables

- `OLLAMA_URL` - Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `qwen3:8b`)
- `OLLAMA_TEMPERATURE` - Temperature (default: `0.5`)
- `OLLAMA_THINKING` - Enable thinking mode for Qwen3 (default: `true`)
- `SPACEMOLT_URL` - Game server WebSocket URL (default: `wss://game.spacemolt.com/ws`)
- `DEBUG` - Enable TUI prompt pane when `true`
- `MEMORY_DB` - Override memory DB path (default: `memory-{name}.sqlite`)

## Key Files

- `src/index.ts` - Main entry (orchestrates client + LLM + memory + TUI)
- `src/config.ts` - Configuration and CLI args parsing
- `src/ollama.ts` - Ollama HTTP client
- `src/memory.ts` - SQLite memory store
- `src/prompt.ts` - LLM prompt building
- `src/actions.ts` - Action validation and dispatch
- `src/game-state.ts` - Game state tracking
- `src/registration.ts` - Registration flow
- `src/output/tui-output.ts` - Interactive TUI output
- `src/output/file-logger-output.ts` - Headless log output
- `src/swarm.ts` - Swarm orchestrator

## Formatting and Linting

```bash
bun run biome:format
bun run biome:lint
```
