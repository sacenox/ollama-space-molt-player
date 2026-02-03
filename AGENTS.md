# Agent Guidelines

## Project Overview

This is an autonomous AI agent client for SpaceMolt, an MMO for AI agents. The client uses MCP (Model Context Protocol) to communicate with the game server and Ollama for local LLM inference with tool calling.

## Architecture

### Core Components

- **MCP Client** (`mcp-client.ts`): Connects to SpaceMolt's MCP server, discovers tools, executes tool calls
- **Ollama Client** (`ollama.ts`): Wraps Ollama's `/api/chat` endpoint with tool support
- **Game Client** (`game-client.ts`): Orchestrates the agent loop between MCP and Ollama
- **Database** (`db.ts`): SQLite persistence for accounts and message history

### Agent Loop

```
1. LLM receives messages + available tools
2. LLM responds with tool_calls (or content)
3. Execute each tool call via MCP
4. Append results to messages
5. Repeat until LLM responds without tool calls (max 10 iterations)
6. Wait 1 second, start next round
```

### Message Persistence

All interactions are saved to SQLite:

- Tool calls saved as `{ tool, arguments }` (sender: client)
- Tool results saved as `{ tool, success, content }` (sender: server)
- Final LLM responses saved as `{ response }` (sender: client)

On restart, message history is restored to provide context continuity.

## Code Conventions

### TypeScript

- Use strict TypeScript with `noEmit` for type checking
- Prefer interfaces over types for object shapes
- Use explicit return types on public methods

### Error Handling

- Log errors with `logClientError()`, include context
- Don't swallow errors silently
- MCP tool failures should be passed to LLM (it learns from errors)

### Testing

- Tests use Bun's built-in test runner
- Mock external services (Ollama, MCP) in tests
- Run `bun run check` before committing

### Formatting

- Prettier handles formatting
- Run `bun run check:format` to format all files

## File Organization

```
packages/client/src/
├── mcp-client.ts      # MCP connection and tool execution
├── ollama.ts          # Ollama chat API
├── game-client.ts     # Main orchestration
├── db.ts              # SQLite persistence
├── types.ts           # TypeScript types
├── logging.ts         # Structured logging
├── archetypes.ts      # Character personalities
├── model-config.ts    # Model configuration loader
├── cli.ts             # CLI argument parser
└── index.ts           # Entry point
```

## Adding New Features

### New Tool Handling

Tools come dynamically from MCP. To add special handling for a tool result:

```typescript
// In game-client.ts executeToolCall()
if (name === "your_tool" && result.success) {
	await this.handleYourToolSuccess(args, result.content);
}
```

### New Model Support

Add to `player-models.json`:

```json
{
	"your-model": {
		"displayName": "Your Model",
		"ollama": {
			"model": "actual-ollama-model-name",
			"options": { "temperature": 0.7 }
		},
		"recommendedMessages": 50
	}
}
```

Model must support Ollama's tool calling format.

## Common Tasks

### Running the Client

```bash
cd packages/client
bun start -- -i test1 -v
```

### Running Tests

```bash
bun run check        # All checks
bun test             # Tests only
bun test --watch     # Watch mode
```

### Debugging

Enable verbose mode with `-v` flag to see:

- Tool calls and arguments
- Tool results
- LLM thinking (if model supports it)

## Key Design Decisions

1. **LLM has full agency**: The client doesn't make decisions - the LLM decides everything including when to poll notifications, how to handle rate limits, what to do next.

2. **MCP over WebSocket**: Uses HTTP-based MCP transport instead of WebSocket for simpler connection handling.

3. **In-memory + SQLite**: Messages kept in memory for fast access, persisted to SQLite for restart recovery.

4. **Single agent loop**: One round at a time, max 10 tool iterations per round, 1 second delay between rounds.
