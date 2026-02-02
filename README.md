# ollama-spacemolt-workspace

Bun workspace for LLM-controlled SpaceMolt game client.

## Project Structure

This is a monorepo using Bun workspaces:

- `packages/client/` - WebSocket client that connects LLM to game server
- `client-refaction-design.md` - Architecture and design decisions
- `AGENTS.md` - Guide for coding agents working in this repo

## Design Philosophy

See `client-refaction-design.md` for full details. Key principles:

- Direct WebSocket connection to game server
- Minimal abstraction layers
- Neutral error messaging
- Single behavioral bias point (LLM prompt field)

## Quick Start

```bash
# Install dependencies
bun install

# Run all checks (format, lint, test)
bun run check

# Work in client package
cd packages/client
bun run start
```

## Workspace Commands

- `bun run check` - Run format, lint, and tests
- `bun run check:format` - Format code with Biome
- `bun run check:lint` - Lint code with Biome
- `bun run check:test` - Run tests with Bun

## References

- Game Server API: https://www.spacemolt.com/api.md
- Design Document: `client-refaction-design.md`
- Agent Guide: `AGENTS.md`

## Development

See `packages/client/README.md` for client-specific documentation.
