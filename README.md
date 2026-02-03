# ollama-spacemolt-player

Autonomous AI agent that plays [SpaceMolt](https://spacemolt.com) using local LLMs via Ollama.

## Overview

This client connects to SpaceMolt's MCP (Model Context Protocol) server and uses Ollama's native tool calling to let an LLM play the game autonomously. The LLM has full agency - it decides when to mine, trade, fight, chat with other players, and explore the galaxy.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    GameClient                             │
│                                                           │
│   ┌─────────────┐         ┌─────────────────────┐        │
│   │ MCP Client  │◄───────►│ SpaceMolt MCP       │        │
│   │ (94 tools)  │         │ game.spacemolt.com  │        │
│   └──────┬──────┘         └─────────────────────┘        │
│          │                                                │
│          ▼                                                │
│   ┌─────────────┐         ┌─────────────────────┐        │
│   │ Ollama Chat │◄───────►│ Ollama Server       │        │
│   │ (tool calls)│         │ (local LLM)         │        │
│   └─────────────┘         └─────────────────────┘        │
│                                                           │
│   Agent Loop: LLM → tool_calls → MCP execute → repeat    │
└──────────────────────────────────────────────────────────┘
```

### How It Works

1. **MCP Connection**: Client connects to `https://game.spacemolt.com/mcp` and discovers 94 game tools
2. **Tool Conversion**: MCP tools are converted to Ollama's tool format
3. **Agent Loop**: LLM receives game context, makes tool calls, results fed back, repeat
4. **Persistence**: All tool calls and results saved to SQLite for context restoration on restart

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Ollama](https://ollama.ai) running locally

```bash
# Install recommended model
ollama pull qwen3:8b

# Clone and install
git clone https://github.com/sacenox/ollama-space-molt-player.git
cd ollama-space-molt-player
bun install

# Start playing
cd packages/client
bun start
```

### CLI Options

```bash
bun start [OPTIONS]

Options:
  -i, --instance <id>       Instance ID (4 chars, auto-generated if not provided)
  -m, --model <name>        Model config name (default: qwen3-8b)
  -a, --archetype <name>    Character archetype: diplomat, opportunist, agitator
  --hint <text>             Guidance injected into LLM context
  --ollama-timeout <ms>     Ollama API timeout (default: 30000)
  -s, --server <url>        MCP server URL (default: https://game.spacemolt.com/mcp)
  -cw, --context-window <n> Max messages in context (default: 50)
  -v, --verbose             Verbose logging
```

### Examples

```bash
# New character with diplomat personality
bun start -- -i abc1 -a diplomat

# Resume existing instance with hint
bun start -- -i abc1 --hint "Focus on mining titanium"

# Use different model
bun start -- -m llama3.1-8b
```

## Project Structure

```
packages/client/
├── src/
│   ├── mcp-client.ts     # MCP SDK connection, tool discovery, execution
│   ├── ollama.ts         # Ollama chat API with tool calling
│   ├── game-client.ts    # Agent loop orchestration
│   ├── db.ts             # SQLite persistence
│   ├── archetypes.ts     # Character personalities
│   ├── logging.ts        # Structured logging
│   └── cli.ts            # CLI argument parser
└── tests/
```

## Models

Configured in `player-models.json`:

| Config Name  | Model        | Tool Support | Notes                |
| ------------ | ------------ | ------------ | -------------------- |
| qwen3-8b     | qwen3:8b     | Yes          | Default, recommended |
| qwen3-4b     | qwen3:4b     | Yes          | Lighter weight       |
| llama3.1-8b  | llama3.1:8b  | Yes          | Good alternative     |
| mistral-nemo | mistral-nemo | Yes          | Larger context       |

## Development

```bash
# Run all checks
bun run check

# Run tests
bun test

# Format code
bun run check:format
```

## License

MIT
