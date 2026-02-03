# ollama-spacemolt-workspace

Bun workspace for LLM-controlled SpaceMolt game client.

## Project Structure

This is a monorepo using Bun workspaces:

- `packages/client/` - WebSocket client that connects LLM to game server
- `docs/2026-02-03-client-refactor-design.md` - Architecture and design decisions
- `AGENTS.md` - Guide for coding agents working in this repo

## Design Philosophy

See `docs/2026-02-03-client-refactor-design.md` for full details. Key principles:

- Direct WebSocket connection to game server
- Minimal abstraction layers
- Neutral error messaging
- Single behavioral bias point (LLM prompt field)

## Quick Start

```bash
# Install dependencies
bun install

# Configure Ollama server (REQUIRED)
export OLLAMA_CONTEXT_LENGTH=16384

# Start Ollama server
ollama serve

# In another terminal, pull the default model
ollama pull lfm2.5-thinking

# Run all checks (format, lint, test)
bun run check

# Work in client package
cd packages/client
bun run start
```

**Important:** Set `OLLAMA_CONTEXT_LENGTH=16384` before starting the Ollama server. The default limit (4096) truncates prompts and causes the bot to forget recent game history.

Model configurations are defined in `player-models.json` at the repo root.

## Code Quality

### No Comments Policy

This project automatically strips all code comments during the check process. This may seem unusual, but it serves an important purpose:

**Why no comments?**

- AI agents make incremental edits and often miss updating related comments
- Outdated comments mislead future developers and agents more than missing comments
- Forces code to be self-documenting through clear naming and structure

**When are comments stripped?**

- Automatically during `bun run check`
- After formatting and before linting/testing

**How to write self-documenting code:**

- Use descriptive variable and function names
- Keep functions small and focused
- Use type annotations to document interfaces
- Structure code logically with clear separation of concerns
- Extract complex logic into named functions

**What about documentation?**

- User-facing documentation belongs in markdown files (README.md, design docs)
- API documentation can use JSDoc in declaration files if needed
- Design decisions should be captured in `docs/2026-02-03-client-refactor-design.md`

## Workspace Commands

- `bun run check` - Run format, lint, and tests
- `bun run check:format` - Format code with Prettier
- `bun run check:lint` - Type-check with TypeScript
- `bun run check:test` - Run tests with Bun

## Troubleshooting

### Ollama truncation warnings

If you see `truncating input prompt` warnings in Ollama server logs:

**Symptom:** Bot forgets recent game events and repeats failed actions

**Cause:** Ollama's default context limit (4096 tokens) is too small for game state history

**Solution:**

1. Stop Ollama server
2. Set environment variable: `export OLLAMA_CONTEXT_LENGTH=16384`
3. Restart: `ollama serve`

**For systemd service:**

```bash
sudo systemctl edit ollama
```

Add to the override file:

```ini
[Service]
Environment="OLLAMA_CONTEXT_LENGTH=16384"
```

Then restart the service:

```bash
sudo systemctl restart ollama
```

## References

- Game Server API: https://www.spacemolt.com/api.md
- Design Document: `docs/2026-02-03-client-refactor-design.md`
- Agent Guide: `AGENTS.md`

## Development

See `packages/client/README.md` for client-specific documentation.
