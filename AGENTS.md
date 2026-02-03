# Agent Guide for ollama-spacemolt-player

Help coding agents work safely and consistently in this repo.

## Important References

**Design Document**: `docs/2026-02-03-client-refactor-design.md` - Primary source of truth for architecture and design decisions

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
├── scripts/
│   └── strip-comments.ts  # Comment removal script
├── docs/
│   └── 2026-02-03-client-refactor-design.md  # Sacred design document
├── package.json         # Workspace root
├── tsconfig.json        # Base TypeScript config
└── .prettierrc.json    # Prettier configuration
```

## Design Principles

From `docs/2026-02-03-client-refactor-design.md`:

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
bun run strip-comments   # Strip comments from TypeScript files
bun run check:format     # Format with Prettier
bun run check:lint       # TypeScript compilation check
bun run check:test       # Run tests
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

- Use Prettier for all formatting
- TypeScript compilation (`tsc --noEmit`) for linting
- Tabs for indentation (2-space width)
- 100 character line width
- Semicolons, double quotes, trailing commas

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

## Tick Processing

The client uses a server-driven tick system with critical safety mechanisms:

**Processing Lock:**

- Only one tick can process at a time (enforced by `isProcessingTick` flag)
- If a new tick arrives while previous tick is still processing, it is skipped
- Prevents parallel LLM calls that would violate game server rate limits
- Skipped ticks are logged but not saved to database

**Flow:**

1. Server sends tick message every ~10 seconds
2. Client checks if currently processing (`isProcessingTick`)
3. If processing: log skip and return
4. If not: set lock, process tick (LLM call + command send), release lock

**Why this matters:**

- LLM calls can take 8-12 seconds (variable)
- Tick interval is 10 seconds (fixed)
- Without lock: overlapping ticks cause rate limiting errors
- With lock: sequential processing matches game server expectations

## Error Handling

- Neutral, factual language only
- Follow error terminology from api.md
- No behavioral bias in error messages
- Client errors logged but don't stop tick loop

## Development Workflow

1. Read `docs/2026-02-03-client-refactor-design.md` for context
2. Make changes aligned with design principles
3. Run `bun run check` before committing (strips comments, formats, lints, tests)
4. Keep abstractions minimal
5. Test with real game server when possible

## Code Quality

### No Comments Policy

**Comments are automatically stripped from all TypeScript files during the check process.** This prevents outdated comments from misleading future agents as code evolves.

**Why this matters for AI agents:**

- Agents make edits in chunks and often miss contextual comments
- Outdated comments create false assumptions about code behavior
- Comments can contradict actual implementation after refactoring
- Self-documenting code is more reliable than potentially stale documentation

**When comments are stripped:**

- During `bun run check` (after formatting, before linting)
- Applies to all `.ts` files in `packages/*/src/**` and `packages/*/tests/**`
- ALL comments are removed: single-line (`//`), multi-line (`/* */`), JSDoc

**Write self-documenting code instead:**

- Clear variable and function names that explain intent
- Small, focused functions (easier to understand at a glance)
- Type annotations for function signatures
- Well-structured code organization
- Descriptive constant names instead of magic numbers

**Example - Instead of:**

```typescript
const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
```

**Write:**

```typescript
function calculateDistance(point1: Point, point2: Point): number {
	const deltaX = point2.x - point1.x;
	const deltaY = point2.y - point1.y;
	return Math.sqrt(deltaX ** 2 + deltaY ** 2);
}
```

**Where to document:**

- Design decisions → `docs/2026-02-03-client-refactor-design.md`
- Architecture patterns → `AGENTS.md` (this file)
- User instructions → `README.md`
- API reference → Markdown files or separate docs

## What NOT to Do

- Do not add intermediate translation layers
- Do not add behavioral bias outside `prompt` field
- Do not modify sacred `docs/2026-02-03-client-refactor-design.md`
- Do not commit `*.sqlite` or `*.log` files
- Do not create backward compatibility with old implementation
- **Do not access files outside of the repo root** - All file operations must stay within `/home/xonecas/src/ollama-spacemolt-player`
- **Run all commands in the repo root** - Use the `workdir` parameter if needed, but default to repo root
