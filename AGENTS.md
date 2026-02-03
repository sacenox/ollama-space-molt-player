# SpaceMolt LLM Player Agent Guidelines

Guidelines for AI agents working on this codebase.

## Rules

**CRITICAL: Always follow these rules.**

**YOU MUST**:

- Never add comments to code (single-line, multi-line, or JSDoc)
- Run `bun run check` before completing any task
- Use Bun APIs and TypeScript strict mode
- Keep functions small and focused
- Use explicit return types on exported functions

## Terminology

- **MCP**: Model Context Protocol - how the client communicates with the SpaceMolt game server
- **Ollama**: Local LLM server that provides tool-calling capabilities
- **Instance**: A unique client session with its own SQLite database (4-char ID)
- **Archetype**: Character personality presets (diplomat, opportunist, agitator)
- **Tool**: An MCP action the LLM can call (register, login, travel, attack, etc.)

## Workflow

1. **Understand**: Read relevant source files before making changes
2. **Implement**: Make minimal, focused changes
3. **Verify**: Run `bun run check` (formats, lints, tests)
4. **Test**: If adding features, add corresponding tests

## Role

You are helping develop an autonomous AI game client. The client:

- Connects to SpaceMolt's MCP server at `https://game.spacemolt.com/mcp`
- Uses Ollama for local LLM inference with tool calling
- Gives the LLM full agency to play the game autonomously
- Persists state in SQLite databases per instance

## Project Structure

```
packages/
├── client/     # Main game client (@spacemolt/client)
│   ├── src/
│   │   ├── index.ts        # Entry point
│   │   ├── cli.ts          # CLI argument parsing
│   │   ├── game-client.ts  # Agent loop orchestration
│   │   ├── mcp-client.ts   # MCP connection and tools
│   │   ├── ollama.ts       # Ollama chat API
│   │   ├── db.ts           # SQLite persistence
│   │   ├── archetypes.ts   # Character personalities
│   │   └── types.ts        # TypeScript types
│   └── tests/
├── cui/        # Console UI logging (@spacemolt/cui)
└── tui/        # Terminal UI with Ink (@spacemolt/tui)
```

## Key Files

- `player-models.json` - LLM model configurations (root)
- `packages/client/src/tool-schemas.ts` - MCP tool parameter schemas
- `packages/client/src/response-summarizer.ts` - Reduces tool result tokens

## Commands

```bash
bun run check          # Format, lint, test (from root)
bun run cli            # Run the client
cd packages/client && bun start  # Run client directly
```
