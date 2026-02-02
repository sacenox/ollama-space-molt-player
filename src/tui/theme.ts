// 80s Retro Sci-Fi Theme
// Palette: Muted, utilitarian, high contrast text on dark backgrounds.

export const PALETTE = {
	// Base Colors
	BLACK: "black",
	WHITE: "white",
	GRAY: "gray",

	// Theme Colors
	AMBER: "yellow", // Primary interface color (retro terminal)
	SLATE: "blue", // Structural elements
	// Removed TEAL (cyan) per request
	BRICK: "red", // Alerts
	MOSS: "green", // Success/Safe
	ORANGE: "magenta", // Highlights
} as const;

export const THEME = {
	// Panel Styling
	BORDER_ACTIVE: PALETTE.AMBER,
	BORDER_INACTIVE: PALETTE.SLATE,
	TITLE: PALETTE.AMBER,
	LABEL: PALETTE.GRAY, // Was TEAL (Cyan), now GRAY (Silver/Dim) for utility look
	VALUE: PALETTE.WHITE,

	// Status Indicators
	SAFE: PALETTE.MOSS,
	WARNING: PALETTE.AMBER,
	DANGER: PALETTE.BRICK,
	INACTIVE: PALETTE.GRAY,

	// Message Types
	MSG_SYSTEM: PALETTE.SLATE,
	MSG_PLAYER: PALETTE.AMBER, // Player actions stand out
	MSG_GAME: PALETTE.WHITE,
	MSG_AI: PALETTE.MOSS, // Was TEAL, now MOSS (Green) for AI thinking
	MSG_ERROR: PALETTE.BRICK,

	// Progress Bars
	BAR_FILLED: PALETTE.MOSS,
	BAR_EMPTY: PALETTE.GRAY,
	BAR_CRITICAL: PALETTE.BRICK,
	BAR_WARNING: PALETTE.AMBER,
} as const;

export const SYMBOLS = {
	// Geometric progress bars (Dithered style)
	BAR_FULL: "█",
	BAR_MED: "▓",
	BAR_LOW: "▒",
	BAR_EMPTY: "░",

	// List markers
	BULLET: "♦",
	ARROW: "»",

	// Status
	CHECK: "√",
	CROSS: "×",

	// Enhanced status indicators
	SUCCESS: "✓",
	ERROR: "✗",
	INFO: "•",
	WARNING: "!",

	// Spinner frames (Braille patterns)
	SPINNER_FRAMES: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],

	// Action type decorators
	NAV_BLOCK: "═",
	RESOURCE_BLOCK: "▓",
	COMBAT_BLOCK: "█",
	INFO_BLOCK: "─",
} as const;

// ASCII art for activity states (4-5 lines each)
// All lines normalized to exactly 12 characters for consistent box width
export const ACTIVITY_ART = {
	waiting_for_tick: [
		"   ╭─────╮  ",
		"   │ . . │  ",
		"   │  ─  │  ",
		"   ╰zzZ──╯  ",
	],
	requesting_action: [
		"   [?AI?]   ",
		"   ╱ ◉ ◉╲   ",
		"  │ ▼▼▼ │   ",
		"   ╲___╱    ",
	],
	llm_thinking: [
		"   ◉ ◎ ◉    ",
		"  ╱ ⚙ ⚙ ╲   ",
		" │ ⊕ ∞ ⊗ │  ",
		"  ╲ ⚙ ⚙ ╱   ",
	],
	traveling: ["    ═══►    ", "   ───►     ", "  ──►       ", " ─►         "],
	jumping: [" * ═══► *   ", "  * ══►     ", "   *═►      ", " *   ─►     "],
	processing_result: [
		"            ",
		" ▓▓▓▓▓░░░░░ ",
		"  89% ...   ",
		"            ",
	],
	in_combat: ["  ╳  ▓▓▓  ╳ ", " ▓▓  ███ ▓▓ ", "  ╳  ▓▓▓  ╳ ", "  ⚠  ALERT  "],
	docked: [" ┌──┐       ", " │▓▓│═══╣▓  ", " │▓▓│   ║   ", " └──┘═══╝   "],
} as const;
