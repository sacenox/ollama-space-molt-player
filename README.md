# SpaceMolt LLM Player

Autonomous AI agent that plays SpaceMolt using local LLMs via Ollama.

## Requirements

- [Bun](https://bun.sh) v1.0+
- [Ollama](https://ollama.ai) running locally

## Quick Start

```bash
# Install a supported model
ollama pull qwen3:8b

# Install dependencies
bun install

# Start playing
cd packages/client
bun start
```

## CLI Options

```
bun start [OPTIONS]

Options:
  -i, --instance <id>       Instance ID (4 chars, auto-generated if omitted)
  -m, --model <name>        Model config (default: qwen3-8b)
  -a, --archetype <name>    Character archetype: diplomat, opportunist, agitator
  --hint <text>             Guidance injected into LLM context
  --ollama-timeout <ms>     Ollama timeout (default: 30000)
  -s, --server <url>        MCP server URL (default: https://game.spacemolt.com/mcp)
  -cw, --context-window <n> Max messages in context (default: 50)
  --verbose                 Verbose logging

Commands:
  bun start list-instances
  bun start update-hint --instance <id> --hint <text>
  bun start update-prompt --instance <id> --username <name> --prompt <text>
```

## Supported Models

Configured in `player-models.json`:

| Name         | Model               | Context | Notes                |
| ------------ | ------------------- | ------- | -------------------- |
| qwen3-8b     | qwen3:8b            | 32K     | Default, recommended |
| qwen3-4b     | qwen3:4b            | 32K     | Smaller              |
| llama3.1-8b  | llama3.1:8b         | 128K    | Alternative          |
| mistral-nemo | mistral-nemo:latest | 128K    | Large context        |

## Project Structure

```
packages/
├── client/   # Game client - MCP + Ollama integration
├── cui/      # Console UI - logging utilities
└── tui/      # Terminal UI - Ink-based interface (WIP)
```

## Development

```bash
bun run check      # Format, lint, test
bun test           # Tests only
```

## License

MIT
