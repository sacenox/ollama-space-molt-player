# Agent Guide for ollama-spacemolt-player

Help coding agents work safely and consistently in this repo.

## Important References

**Design Document**: `client-refaction-design.md` - Primary source of truth for architecture and design decisions

**Game Server WebSocket API**: https://www.spacemolt.com/api.md

## Workspace Structure

This is a Bun workspace with the following layout:

```
ollama-spacemolt-workspace/
├── packages/
│   └── client/          # WebSocket client package
│       ├── src/         # Source code
│       ├── tests/       # Unit tests
│       └── package.json
├── client-refaction-design.md  # Sacred design document
├── package.json         # Workspace root
├── tsconfig.json        # Base TypeScript config
└── biome.json          # Workspace-level formatting/linting
```

## Design Principles

From `client-refaction-design.md`:

1. **Reduce abstraction** - Minimize layers between client and server
2. **Direct connection** - Connect to WebSocket without intermediate libraries
3. **Neutral errors** - Use language from api.md, avoid behavioral bias
4. **Single bias point** - Only `prompt` field influences LLM behavior
5. **Minimal translation** - Forward game events directly to LLM

## Commands

### Workspace Level

```bash
# Install dependencies
bun install

# Run all checks (format, lint, test)
bun run check

# Individual checks
bun run check:format
bun run check:lint
bun run check:test
```

### Client Package

```bash
cd packages/client

# Run checks
bun run check

# Start client (once implemented)
bun run start
```

## Code Style Guidelines

### Formatting
- Use Biome for all formatting and linting
- Tabs for indentation (2-space width)
- Let Biome handle style automatically

### Naming Conventions
- Types/interfaces: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- File names: `kebab-case.ts`

### TypeScript
- `strict` mode enabled
- Avoid `any`, use `unknown` then narrow
- Explicit return types for public functions
- Prefer `null` over `undefined` for absent values

### Testing
- Use Bun's built-in test runner (`bun test`)
- Target: 80% coverage for client code
- Unit tests for core logic
- Manual tests for TUI (screenshots)

## Database

SQLite via `bun:sqlite`:
- Pattern: `memory-{instance-id}.sqlite`
- Two tables: `account_details`, `messages`
- Maximum 5000 messages, sorted by tick
- Unique instance ID per client (4 characters)

## Error Handling

- Neutral, factual language only
- Follow error terminology from api.md
- No behavioral bias in error messages
- Client errors logged but don't stop tick loop

## Development Workflow

1. Read `client-refaction-design.md` for context
2. Make changes aligned with design principles
3. Run `bun run check` before committing
4. Keep abstractions minimal
5. Test with real game server when possible

## What NOT to Do

- Do not add intermediate translation layers
- Do not add behavioral bias outside `prompt` field
- Do not modify sacred `client-refaction-design.md`
- Do not commit `*.sqlite` or `*.log` files
- Do not create backward compatibility with old implementation
