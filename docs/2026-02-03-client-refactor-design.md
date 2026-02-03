# Client Refactor Design

## Motivation

The current implementation has three core issues:

1. **Behavior bias** - Prompt and translation layer bias LLM player behavior
2. **Translation complexity** - Translation layer creates bug surface and complicates development
3. **Tight coupling** - TUI and client logic are not properly decoupled

## Goals

### Architecture

- **Reduce abstraction** - Minimize layers between client and server
- **Simplify protocol** - Streamline game update forwarding to LLM player
- **Direct server sync** - Use MOTD messages and [Game Server API](https://www.spacemolt.com/api.md) for quick updates
- **Workspace structure** - Migrate to [Bun Workspaces](https://bun.com/docs/pm/workspaces)
- **Package separation** - Split TUI and Client into separate packages with TUI imported by client
- **Shared code across both packages** - Like types, test tools, or other future utilities, should be in a shared package in this workspace.
- **Unified tooling** - Bun scripts in repo root (with/without TUI), shared Prettier config

### Database

- **Simplified schema** - Two tables only:
  - `account_details`: credentials, username, id, hint, prompt
  - `messages`: raw JSON server communication, id, tick, client/server sender enum
- **Proper indexing** - Optimized for query patterns, tick for sorting by it
- **Size management** - Truncate messages table to 5000 rows max sorted by tick when read.
- **SQLite with Bun** - Continue using Bun to interact with SQLite
- **Instancing** - Use a unique ID for each database instance, this ID is used as argument to bind future runs to a specific instance. use memory-{instance-name}.sqlite for the file pattern, instance name should be a simple random generation of 4 character.

### Performance

- **Token efficiency** - Reduce tokens sent per tick
- **Fast failures** - Quick Ollama timeouts to avoid losing ticks
- **Optimized prompting** - Fewer Ollama calls, faster prompt generation per tick

### Testing

- **Combined approach** - Unit tests + manual visual tests for TUI (print UI components to terminal or screenshot the TUI)
- **Coverage target** - 80% test coverage at the end of the refactor in the client code.
- **TUI** - test scripts to run manually to create screenshots for visual inspection.

## Non-Goals

- **No backward compatibility** - New DB schema, fresh start
- **No legacy code reuse** - Apply lessons learned to build clean foundation

## Client Design

### Core Principles

- **Direct connection** - Connect to `wss://game.spacemolt.com/ws` without intermediate libraries
- **Server sync** - Use [api.md](https://www.spacemolt.com/api.md) to maintain client-server compatibility
- **API merging** - Extend game server API while maintaining JSON protocol consistency
- **Registration shadowing** - Hook register command to generate player prompt along with registration
- **Instances** - Each running client instance has an independent database file. Complete data separation between instances.
- **Errors** - When showing errors to the LLM, always use the language found in the api.md document from the server. If we need to add our own messaging at any time, use neutral terms without bias, let the LLM decide based on his configured bias.

### Ollama

- A ollama server will be available. manually controlled by the user.
- A single call per tick, sends full JSON context including prompt.
- Used in the registatrion flow
- Ollama calls need to fail fast, they should resolve in less than 1 tick so that the player doesn't loose more than 1 turn waiting for generation.
- If the ollama call fails add a client error message
- Model thinking should be a cli argument of the client and not saved anywhere in it's entirety as it's usually a lot of tokens. Default to thinking on but at the lowest values for quick thinking. (You can assume the model is qwen3:8b as default.)
- Model temperature should be a config value as well, with a high creativity temprature (1.2)

### Registration flow

- When the LLM player calls register it will do so with the same arguments the server api requires.
- We will intercept and use those arguments to prompt the LLM for a bias prompt based on Name and empire + a behavuour archtype that fits the MMO RPG genre for a sci fi universe of Crustaceans Cosmos.
- Archtypes are suggested gameplay styles defined in code, as constants, it should be a concise excerpt defining a common gamestyle suitable for an Online multiplayer rpg game.
  - **The Diplomat** (Good): Seeks alliances through negotiation and mutual benefit. Prioritizes faction reputation, mediates conflicts in forums, and builds cooperative trade networks. Values honor and collective prosperity.
  - **The Opportunist** (Neutral): Adapts strategy based on maximum personal gain. Engages in strategic alliances when beneficial, participates in forums to gather intelligence, and switches loyalties based on opportunity. Values pragmatism and survival.
  - **The Agitator** (Evil): Thrives on chaos and manipulation. Spreads misinformation in forums, provokes faction conflicts, forms temporary alliances to backstab later, and profits from instability. Values power and dominance through deception.
  - Archetypes can be specified via config too (and cli).
- Once started the registatrion flow needs to complete, retry with the LLM showing clear errors if any.

### Client Flow

**1. Initialization**

- Parse CLI arguments (each custom API field has corresponding CLI arg; currently just hint)
- Check for existing account:
  - If exists: auto-login and continue
  - **Note**: Auto-login only at boot; respect LLM logout decisions (no re-login)

**2. Main Loop** (Server tick-driven)

Client reacts to server `tick` messages instead of using a fixed interval timer. This ensures perfect synchronization with server tick boundaries and prevents rate-limiting errors.

**Tick Synchronization:**

- Server sends `tick` message every 10 seconds
- Client receives tick message and immediately processes:
  - Updates `currentTick` value
  - Debounces duplicate tick messages (tracks `lastProcessedTick`)
  - Resets watchdog timer (detects missing ticks after 20 seconds)
  - Triggers LLM prompt and command generation

**Each tick processing:**

a. **Prompt LLM**

- Check for hint updates in database
- Provide: game event history + combined API + prompt + hint
- On client error: create client event in DB (avoid behavioral bias, do use words that can be interpreted as suggestions or directions), continue to next tick

b. **Forward Response**

- Send LLM reply to server
- On connection failure: create client message, continue to next tick

c. **Wait for next server tick**

**Safety mechanisms:**

- **Duplicate detection**: Ignores duplicate tick messages using `lastProcessedTick` tracking
- **Processing lock**: Prevents parallel tick processing when LLM response time exceeds tick interval
  - Uses `isProcessingTick` flag to ensure only one tick processes at a time
  - Skips subsequent ticks if previous tick still processing (logs skip, no DB entry)
  - Prevents rate limiting violations and resource waste from parallel LLM calls
- **Watchdog timer**: Warns if no tick received within `tick_rate * 2` (20 seconds)
- **Connection monitoring**: Logs watchdog timeouts as client errors in database

### API Extensions

**Custom Registration Command**

- Hook registration to inject character prompt and hint when LLM creates new character

**LLM Player Prompt Field**

- New JSON API field describing player character
- **Single point of behavioral bias** - Only place to influence LLM toward character traits
- Generated from registration personality traits
- Hint injection capability (refreshed every tick) from the database

**Format**:

```jsonc
{
	"prompt": "...", // Generated at registration
	"hint": "...", // Optional injected message
	// Standard commands from https://www.spacemolt.com/api.md
}
```

### Output

- When running without TUI, print human-readable log lines without omitting information for every message. No log files, no multiple instance support.

### Client API Data Formats

**What the LLM receives each tick:**

```jsonc
{
	"prompt": "...",
	"hint": "...",
	"history": [
		{
			"sender": "server",
			"tick": 42,
			"data": {
				"action": "move",
				"result": "success",
				"message": "You moved to sector Alpha-7",
			},
		},
		{
			"sender": "client",
			"tick": 43,
			"data": {
				"error": "Connection interrupted",
			},
		},
	],
	"api": {
		"register": {
			"args": ["username", "empire"],
			"description": "Register a new character",
		},
		"chat": {
			"args": ["message"],
			"description": "Send a chat message",
		},
		"move": {
			"args": ["sector"],
			"description": "Move to a different sector",
		},
		// ... rest of server API from api.md
	},
}
```

**Client error message format:**

```jsonc
{
	"sender": "client",
	"tick": 45,
	"data": {
		"error": "Network connection interrupted",
		"code": "CONNECTION_FAILED",
	},
}
```

**Client messages follow server patterns:**

- Same JSON structure (sender, tick, data)
- Neutral, factual language
- Consistent error codes and messaging

# TUI Design

## Design Thinking Approach

**Context & Purpose**

- Terminal interface for LLM-controlled game client
- Users: developers/observers monitoring AI gameplay
- Primary function: real-time game state visualization and debugging

**Aesthetic Direction: 1980's Sci-Fi Terminal**

- **Tone**: Retro-futuristic, raw technical aesthetic
- **Differentiation**: Authentic vintage terminal feel with modern Unicode precision
- **Key memorable element**: Cohesive sci-fi terminal atmosphere that feels functional, not decorative

**Design Principles**

- **Typography**: Monospace (terminal native), rely on weight and spacing for hierarchy
- **Color & Theme**: Basic 16 terminal colors only - commit to restrained palette with intentional accent use
- **Spatial Composition**: Grid-based layouts with clear information hierarchy, generous use of borders and separators
- **Visual Details**: ASCII art iconography, modern Unicode for clean lines and boxes, layered information density
- **Motion**: Static by nature (terminal), but consider progressive reveals and state transitions, plenty of continuous animations, particularly to show activity.

**Implementation Strategy**

- Start with smallest reusable components, build up to complex layouts
- Precision in spacing, alignment, and container handling
- Handle resize gracefully - test at multiple terminal sizes
- No emojis - maintain technical aesthetic purity

**Focus Areas**

- Clear visual hierarchy through boxing, spacing, and ASCII decoration
- Cohesive use of Unicode line-drawing characters
- Intentional color use - dominant theme color with sharp accents for state/alerts
- Information density balanced with readability

## Game client considerations

Should separate player actions and their responses from other server messages.
Should separate chat and forum interactions to a social grouping.
Show all game data, use main panels for player actions and response as well as social actions. Sidebars and panels for other data.
Should clearly show current game tick, and the different states of the client game loop.

# TUI library

We should Ink as it's actively maintained. https://github.com/vadimdemedes/ink

---

## Milestones

### 1. Clean Slate [ DONE ]

- Switch to git branch `refactor-new-client-internals`
- Wipe project: remove previous code, logs, memory files
- Update agents file: reference this document, remove old implementation details
- Migrate to Bun workspace structure
- Configure Prettier at workspace level (using Prettier instead of Biome for formatting)
- Create client package boilerplate:
  - Bun `check` command (format with Prettier, lint with TypeScript, tests)
  - Placeholder README

### 2. Client Package Development [ ]

- Create server mock from [api.md](https://www.spacemolt.com/api.md)
- Build test suite for desired features
- Implement core functionality
- Ensure all tests pass
- Add a Bun command to update the hint for an existing database file.

### 3. TUI [ ]

- Create the TUI Bun package.
- Create manual tests that render individual UI components in isolation and create a screenshot for layout and color verification.
- Generate some tests that render a preview of the new design.
  - Test components with different size configurations to ensure it's resizeable.
- Review before proceeding (human decision)
- Implement the individual components (don't create components that we dont use.)
- Compose the final UI
- Ask for manual UI check in varied terminals (human decision)

---

**IMPORTANT** - This plan file is sacred NEVER delete it in any case.
