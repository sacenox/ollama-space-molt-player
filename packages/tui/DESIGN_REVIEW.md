# TUI Design Review

## Status

Ready for review before implementation.

## What's Been Done

1. **Package Structure** ✓
   - Created `packages/tui/` with Ink + React + TypeScript
   - Configured Prettier and TypeScript
   - Set up Bun workspace integration

2. **Test Harness** ✓
   - Manual test runner for visual inspection
   - Screenshot capture script
   - Located in `tests/manual/`

3. **Design System** ✓
   - 1980s sci-fi terminal theme (colors, ASCII art, Unicode borders)
   - Type definitions for game state and UI data
   - Located in `src/theme.ts` and `src/types.ts`

4. **Preview Tests** ✓
   - Layout preview at 4 different terminal sizes (80x24, 100x30, 120x30, 160x40)
   - Individual component previews (Header, Player Actions, Social, Ship Status, Server Messages)
   - Screenshots captured in `tests/manual/screenshots/`

## How to Review

### Run Interactive Previews

```bash
cd packages/tui

# View layout at different sizes
bun tests/manual/layout-preview.tsx

# View individual components
bun tests/manual/component-previews.tsx
```

Press Ctrl+C to exit. Tests show one view at a time.

### View Screenshots

```bash
# Layout previews
cat tests/manual/screenshots/layout-preview.txt

# Component previews
cat tests/manual/screenshots/component-previews.txt
```

## Design Highlights

### 1980s Sci-Fi Terminal Aesthetic

- **Colors**: 16-color palette (cyan primary, blue borders, magenta accents)
- **Typography**: Monospace with ASCII art icons (◆ ★ ▲ •)
- **Borders**: Unicode box-drawing (single and double borders)
- **Layout**: Grid-based with clear information hierarchy

### Layout Structure

```
╔═══════════════════════════════════════════════╗
║ HEADER: Tick, Status                          ║
╚═══════════════════════════════════════════════╝
┌────────────────────────────┬──────────────────┐
│ ◆ PLAYER ACTIONS &         │ ★ SHIP STATUS    │
│   RESPONSES                │                  │
│ (Main focus area)          │ (Sidebar)        │
├────────────────────────────┼──────────────────┤
│ ◆ SOCIAL                   │ ▲ SERVER         │
│ [CHAT | FORUM]             │   MESSAGES       │
│                            │ (Categorized)    │
└────────────────────────────┴──────────────────┘
```

### Components

1. **Header** - Double border, shows tick and client loop state
2. **Player Actions Panel** - Command history with responses (success/error/info)
3. **Social Panel** - Chat messages + Forum posts
4. **Ship Status Sidebar** - Health, fuel, credits, location
5. **Server Messages Sidebar** - Categorized system messages

## Questions for Review

1. **Layout**: Does the 4-panel layout (actions, social, ship status, server messages) feel balanced?
2. **Aesthetic**: Does the 1980s sci-fi terminal aesthetic come through?
3. **Information Hierarchy**: Is it clear what the main focus area is (player actions)?
4. **Readability**: Are the ASCII icons and colors effective without being cluttered?
5. **Sizing**: Do the components resize reasonably at different terminal sizes?

## Next Steps After Approval

Once approved, will implement:

- Individual component files (Header, PlayerActionsPanel, etc.)
- Animation system for activity indicators
- Final composed UI with proper data flow
- Resize behavior testing
- Final verification in multiple terminals

## Changes Needed?

If changes are needed, document them here before proceeding with implementation.

---

**Ready for review? Run the preview tests and provide feedback!**
