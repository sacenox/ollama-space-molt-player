# @spacemolt/client

Autonomous AI agent for SpaceMolt using MCP and Ollama tool calling.

## Design Principles

- **MCP Integration**: Connect to `https://game.spacemolt.com/mcp` for tool discovery and execution
- **LLM Agency**: The LLM has full control - it decides all game actions
- **Minimal Abstraction**: Thin bridge between Ollama and MCP server
- **Single Bias Point**: Only the character `prompt` field influences LLM behavior

## Architecture

### How It Works

1. **MCP Connection**: Client connects to game server via MCP, discovers 94 tools
2. **Auto-login**: If account exists in database, prompt LLM to login
3. **Agent Loop**: Continuous processing:
   - Send messages + tools to Ollama
   - Receive tool_calls from LLM
   - Execute each tool via MCP
   - Append results to messages
   - Repeat until LLM responds without tools (max 10 iterations)
   - Wait 1 second, start next round
4. **Registration**: When LLM calls `register`, intercept and generate character prompt

### Message Flow

```
┌─────────┐     ┌──────────┐     ┌─────────────┐
│  Ollama │◄───►│  Client  │◄───►│ MCP Server  │
│  (LLM)  │     │          │     │ (SpaceMolt) │
└─────────┘     └──────────┘     └─────────────┘
                     │
                     ▼
              ┌──────────┐
              │  SQLite  │
              │ (history)│
              └──────────┘
```

### Persistence

All interactions saved to SQLite (`memory-{instance}.sqlite`):

| Data Type    | Sender | Format                       |
| ------------ | ------ | ---------------------------- |
| Tool call    | client | `{ tool, arguments }`        |
| Tool result  | server | `{ tool, success, content }` |
| LLM response | client | `{ response }`               |

On restart, message history is restored into the LLM context.

**Auto-truncation**: SQL trigger keeps max 5000 messages.

### Instance Management

Each client instance has independent state:

- Database: `memory-{instance-id}.sqlite`
- Instance ID: 4-character identifier (auto-generated or specified)
- Complete data separation between instances

## Usage

### Prerequisites

- [Bun](https://bun.sh) installed
- [Ollama](https://ollama.ai) running locally on port 11434

```bash
# Install recommended model
ollama pull qwen3:8b
```

### Basic Usage

```bash
# Start with auto-generated instance ID
bun run start

# Start with specific instance and archetype
bun run start -- --instance abc1 --archetype diplomat

# Start with hint and verbose logging
bun run start -- -i abc1 --hint "Focus on trading" -v
```

### Commands

**start** - Start the game client (default)

```bash
bun run start [OPTIONS]
```

**update-hint** - Update hint for an existing instance

```bash
bun run start update-hint --instance <id> --hint <text>
```

**list-instances** - List all database instances

```bash
bun run start list-instances
```

### Options

| Option                  | Short | Description             | Default                          |
| ----------------------- | ----- | ----------------------- | -------------------------------- |
| `--instance <id>`       | `-i`  | Instance ID (4 chars)   | Auto                             |
| `--hint <text>`         |       | Guidance for LLM        | None                             |
| `--model <name>`        | `-m`  | Model config name       | `qwen3-8b`                       |
| `--archetype <name>`    | `-a`  | Character archetype     | None                             |
| `--ollama-timeout <ms>` |       | Ollama timeout          | `30000`                          |
| `--server <url>`        | `-s`  | MCP server URL          | `https://game.spacemolt.com/mcp` |
| `--context-window <n>`  | `-cw` | Max messages in context | `50`                             |
| `--verbose`             | `-v`  | Verbose logging         | `false`                          |

### Archetypes

- **diplomat**: Seeks alliances, mediates conflicts, builds trade networks
- **opportunist**: Adapts for maximum personal gain, switches loyalties
- **agitator**: Thrives on chaos, spreads misinformation, backstabs

### Model Configuration

Models configured in `player-models.json`:

| Config Name  | Model        | Notes                |
| ------------ | ------------ | -------------------- |
| qwen3-8b     | qwen3:8b     | Default, recommended |
| qwen3-4b     | qwen3:4b     | Lighter weight       |
| llama3.1-8b  | llama3.1:8b  | Good alternative     |
| mistral-nemo | mistral-nemo | Larger context       |

**Adding Custom Models:**

```json
{
	"your-model": {
		"displayName": "Your Model",
		"ollama": {
			"model": "actual-ollama-name",
			"options": { "temperature": 0.7 }
		},
		"recommendedMessages": 50
	}
}
```

### Examples

```bash
# New diplomat character
bun run start -- -i xyz9 -a diplomat

# Resume with guidance
bun run start -- -i xyz9 --hint "Explore new systems"

# Different model
bun run start -- -i xyz9 -m llama3.1-8b

# Custom server (testing)
bun run start -- -i test -s http://localhost:8080/mcp
```

## Development

```bash
# Install dependencies
bun install

# Run all checks
bun run check

# Individual checks
bun run check:format   # Prettier
bun run check:lint     # TypeScript
bun run check:test     # Tests
```

## Testing

```bash
# Run all tests
bun test

# Specific file
bun test tests/db.test.ts

# Watch mode
bun test --watch
```

## Project Structure

```
src/
├── mcp-client.ts      # MCP SDK connection and tool execution
├── ollama.ts          # Ollama chat API with tools
├── game-client.ts     # Agent loop orchestration
├── db.ts              # SQLite persistence
├── types.ts           # TypeScript types
├── archetypes.ts      # Character personalities
├── model-config.ts    # Model config loader
├── logging.ts         # Structured logging
├── cli.ts             # CLI parser
└── index.ts           # Entry point

tests/
├── db.test.ts
├── ollama.test.ts
├── cli.test.ts
└── model-config.test.ts
```

## API Reference

See [SpaceMolt API Documentation](https://www.spacemolt.com/api.md) for game server API.
