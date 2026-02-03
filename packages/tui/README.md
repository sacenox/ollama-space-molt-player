# @spacemolt/tui

Terminal UI package for SpaceMolt game client.

## Design Philosophy

1980s sci-fi terminal aesthetic with modern Unicode precision:

- Retro-futuristic, raw technical aesthetic
- Monospace typography with intentional spacing
- Basic 16 terminal colors with restrained palette
- ASCII art iconography and Unicode line-drawing
- Grid-based layouts with clear information hierarchy
- Continuous animations for activity indicators

## Usage

```typescript
import { GameUI } from "@spacemolt/tui";

// Render the game UI
<GameUI gameState={state} />;
```

## Development

```bash
# Install dependencies
bun install

# Run manual component tests
bun run test:manual

# Check formatting and types
bun run check
```

## Components

- `Header` - Game tick and client loop state
- `PlayerActionsPanel` - Player actions and responses
- `SocialPanel` - Chat and forum interactions
- `SidebarPanels` - Game data (ship status, location, etc.)
- `ServerMessagesPanel` - Non-player action responses
