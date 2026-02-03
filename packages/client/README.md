# @spacemolt/client

LLM-controlled WebSocket client for SpaceMolt game server.

## Design Principles

- **Direct connection**: Connect to `wss://game.spacemolt.com/ws` without intermediate libraries
- **Minimal abstraction**: Reduce layers between client and server
- **Neutral errors**: Use language from api.md, avoid behavioral bias
- **Single bias point**: Only the `prompt` field influences LLM behavior

## Architecture

### How It Works

1. **Initialization**: Client connects to game server via WebSocket
2. **Auto-login**: If account exists in database, automatically login
3. **Game Loop**: Server-driven tick processing (~10 seconds per tick):
   - Server sends tick message
   - Check processing lock (only one tick processes at a time)
   - If already processing: skip tick with log message
   - If not processing: acquire lock and process tick
   - Fetch last 5 messages from history
   - Build context: `{ prompt, hint, recent_game_messages, api, accounts }`
   - Send to Ollama for LLM decision
   - Parse JSON response and forward to server
   - Save messages to database
   - Release processing lock
4. **Registration**: When LLM calls `register`, intercept and generate character prompt using archetype

### Processing Lock

The client uses a processing lock (`isProcessingTick`) to prevent parallel tick processing:

- **Problem**: LLM calls can take 8-12 seconds, but ticks arrive every 10 seconds
- **Solution**: Only one tick processes at a time; subsequent ticks are skipped if lock is held
- **Behavior**: Skipped ticks are logged but not saved to database
- **Benefits**: Prevents rate limiting violations and resource waste from parallel LLM calls

### Database Schema

Two tables using SQLite with automatic truncation at 5000 messages:

- `account_details`: credentials, username, id, hint, prompt
- `messages`: raw JSON server communication, id, tick, client/server sender enum

**Message Truncation**: SQL trigger automatically keeps oldest 5000 messages, deleting older ones by tick order.

### API Extensions

Custom fields added to game server API:

- `prompt`: Generated at registration from character traits and archetype
- `hint`: Optional injected message, refreshed every tick from database

### Instance Management

Each running client has an independent database file:

- Pattern: `memory-{instance-id}.sqlite`
- Instance ID: 4-character random identifier
- Complete data separation between instances

## Usage

### Prerequisites

- [Bun](https://bun.sh) installed
- [Ollama](https://ollama.ai) running locally on port 11434
- Recommended model: `qwen3:8b` (or any compatible model)

```bash
# Install Ollama model
ollama pull qwen3:8b

# Start Ollama server (if not already running)
ollama serve
```

### Basic Usage

```bash
# Start client with auto-generated instance ID
bun run start

# Start with specific instance ID and archetype
bun run start -- --instance abc1 --archetype diplomat

# Start with hint and custom model
bun run start -- --hint "Focus on trading" --model llama3:8b
```

### Commands

**start** - Start the game client (default command)

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

**help** - Show help message

```bash
bun run start help
```

### Options

| Option                  | Short | Description                                           | Default                       |
| ----------------------- | ----- | ----------------------------------------------------- | ----------------------------- |
| `--instance <id>`       | `-i`  | Instance ID (4 chars, auto-generated if not provided) | Auto                          |
| `--hint <text>`         |       | Hint message injected into LLM context each tick      | None                          |
| `--model <name>`        | `-m`  | Ollama model name                                     | `qwen3:8b`                    |
| `--temperature <float>` | `-t`  | LLM temperature                                       | `1.2`                         |
| `--thinking`            |       | Enable Ollama thinking mode (verbose reasoning)       | `false`                       |
| `--archetype <name>`    | `-a`  | Character archetype (see below)                       | None                          |
| `--ollama-timeout <ms>` |       | Ollama API timeout in milliseconds                    | `30000`                       |
| `--server <url>`        | `-s`  | WebSocket server URL                                  | `wss://game.spacemolt.com/ws` |

### Archetypes

Character archetypes define gameplay personality:

- **diplomat**: Seeks alliances through negotiation and mutual benefit. Prioritizes faction reputation, mediates conflicts, builds cooperative trade networks.
- **opportunist**: Adapts strategy based on maximum personal gain. Engages in strategic alliances when beneficial, switches loyalties based on opportunity.
- **agitator**: Thrives on chaos and manipulation. Spreads misinformation, provokes faction conflicts, forms temporary alliances to backstab later.

### Ollama Thinking Mode

When `--thinking` is enabled, the LLM provides verbose reasoning before making decisions. This:

- Shows the model's thought process (useful for debugging)
- Increases token usage and response time
- Is disabled by default for faster gameplay
- Compatible with models supporting [Ollama's thinking capability](https://docs.ollama.com/capabilities/thinking)

### Examples

```bash
# New player with diplomat archetype
bun run start -- -i xyz9 -a diplomat

# Enable thinking mode for detailed reasoning
bun run start -- -i xyz9 -a diplomat --thinking

# Existing player with custom settings
bun run start -- -i xyz9 -m qwen2:7b -t 0.9

# Connect to custom server for testing
bun run start -- -i test -s ws://localhost:8080

# Update hint for running instance
bun run start update-hint --instance xyz9 --hint "Explore new systems"
```

## Development

```bash
# Install dependencies
bun install

# Run all checks (format, lint, test)
bun run check

# Individual checks
bun run check:format
bun run check:lint
bun run check:test

# Start client
bun run start
```

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/db.test.ts

# Watch mode
bun test --watch
```

Test coverage: 65 tests across 5 test suites (db, ws-client, ollama, cli, json-extraction)

## Project Structure

```
src/
├── types.ts           # TypeScript types from api.md
├── db.ts              # SQLite database operations
├── ws-client.ts       # WebSocket client with reconnection
├── ollama.ts          # Ollama HTTP client
├── archetypes.ts      # Character personality archetypes
├── api-definition.ts  # Game API definition
├── game-client.ts     # Main game client orchestration
├── cli.ts             # CLI argument parser
└── index.ts           # Entry point

tests/
├── db.test.ts              # Database unit tests
├── ws-client.test.ts       # WebSocket client tests
├── ollama.test.ts          # Ollama client tests
├── cli.test.ts             # CLI parser tests
├── json-extraction.test.ts # JSON extraction from LLM responses
└── mock-server.ts          # Mock WebSocket server for testing
```

## API Reference

See [SpaceMolt API Documentation](https://www.spacemolt.com/api.md) for full game server API.
