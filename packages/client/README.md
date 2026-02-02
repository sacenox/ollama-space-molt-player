# @spacemolt/client

LLM-controlled WebSocket client for SpaceMolt game server.

## Design Principles

- **Direct connection**: Connect to `wss://game.spacemolt.com/ws` without intermediate libraries
- **Minimal abstraction**: Reduce layers between client and server
- **Neutral errors**: Use language from api.md, avoid behavioral bias
- **Single bias point**: Only the `prompt` field influences LLM behavior

## Architecture

### Database Schema

Two tables using SQLite:
- `account_details`: credentials, username, id, hint, prompt
- `messages`: raw JSON server communication, id, tick, client/server sender enum

### API Extensions

Custom fields added to game server API:
- `prompt`: Generated at registration from character traits
- `hint`: Optional injected message, refreshed every tick

### Instance Management

Each running client has an independent database file:
- Pattern: `memory-{instance-id}.sqlite`
- Instance ID: 4-character random identifier
- Complete data separation between instances

## CLI Interface

(To be implemented in Milestone 2)

## Development

```bash
# Run checks (format, lint, test)
bun run check

# Start client
bun run start
```
