// Panel layout and positioning logic

import { THEME } from "./theme";

export interface PanelDimensions {
	left: number;
	top: number;
	width: number | string;
	height: number | string;
}

export interface LayoutConfig {
	leftWidth: number; // Percent
	rightWidth: number; // Percent
}

export const DEFAULT_LAYOUT: LayoutConfig = {
	leftWidth: 25,
	rightWidth: 25,
};

export interface ComputedLayout {
	// Left Column
	player: PanelDimensions;
	ship: PanelDimensions;
	navigation: PanelDimensions;

	// Center Column
	log: PanelDimensions;
	actionResult: PanelDimensions;
	gameStatus: PanelDimensions;

	// Right Column
	tactical: PanelDimensions;
	context: PanelDimensions;

	// Bottom
	statusBar: PanelDimensions;
}

export function computeLayout(
	termWidth: number,
	termHeight: number,
	config: LayoutConfig = DEFAULT_LAYOUT,
): ComputedLayout {
	// Minimum sizes
	const MIN_SIDEBAR_WIDTH = 25;
	const MIN_CENTER_WIDTH = 40;
	const MIN_PANEL_HEIGHT = 4;

	// Calculate absolute widths
	const leftWidthAbs = Math.max(
		MIN_SIDEBAR_WIDTH,
		Math.floor((termWidth * config.leftWidth) / 100),
	);
	const rightWidthAbs = Math.max(
		MIN_SIDEBAR_WIDTH,
		Math.floor((termWidth * config.rightWidth) / 100),
	);
	const centerWidthAbs = Math.max(
		MIN_CENTER_WIDTH,
		termWidth - leftWidthAbs - rightWidthAbs,
	);

	// Available height (minus status bar)
	const availableHeight = termHeight - 1;

	// -- Left Column --
	// Split: Player (25%), Ship (45%), Nav (30%)
	const playerHeight = Math.max(
		MIN_PANEL_HEIGHT,
		Math.floor(availableHeight * 0.25),
	);
	const shipHeight = Math.max(
		MIN_PANEL_HEIGHT,
		Math.floor(availableHeight * 0.45),
	);
	// Give remaining height to navigation to ensure flush bottom
	const navHeight = Math.max(
		MIN_PANEL_HEIGHT,
		availableHeight - playerHeight - shipHeight,
	);

	// -- Center Column --
	// Split: Log (75%), Bottom section (25%)
	// Bottom section splits horizontally: Result (70%) | Status (30%)
	const bottomSectionHeight = Math.max(6, Math.floor(availableHeight * 0.25));
	const logHeight = Math.max(
		MIN_PANEL_HEIGHT,
		availableHeight - bottomSectionHeight,
	);

	const resultWidth = Math.floor(centerWidthAbs * 0.7);
	const statusWidth = centerWidthAbs - resultWidth;

	// -- Right Column --
	// Split: Tactical (40%), Context (60%)
	const tacticalHeight = Math.max(
		MIN_PANEL_HEIGHT,
		Math.floor(availableHeight * 0.4),
	);
	const contextHeight = Math.max(
		MIN_PANEL_HEIGHT,
		availableHeight - tacticalHeight,
	);

	return {
		// Left
		player: {
			left: 0,
			top: 0,
			width: leftWidthAbs,
			height: playerHeight,
		},
		ship: {
			left: 0,
			top: playerHeight,
			width: leftWidthAbs,
			height: shipHeight,
		},
		navigation: {
			left: 0,
			top: playerHeight + shipHeight,
			width: leftWidthAbs,
			height: navHeight,
		},

		// Center
		log: {
			left: leftWidthAbs,
			top: 0,
			width: centerWidthAbs,
			height: logHeight,
		},
		actionResult: {
			left: leftWidthAbs,
			top: logHeight,
			width: resultWidth,
			height: bottomSectionHeight,
		},
		gameStatus: {
			left: leftWidthAbs + resultWidth,
			top: logHeight,
			width: statusWidth,
			height: bottomSectionHeight,
		},

		// Right
		tactical: {
			left: leftWidthAbs + centerWidthAbs,
			top: 0,
			width: rightWidthAbs,
			height: tacticalHeight,
		},
		context: {
			left: leftWidthAbs + centerWidthAbs,
			top: tacticalHeight,
			width: rightWidthAbs,
			height: contextHeight,
		},

		// Bottom
		statusBar: {
			left: 0,
			top: termHeight - 1,
			width: termWidth,
			height: 1,
		},
	};
}

// Helper to create blessed box options from panel dimensions
export function createBoxOptions(
	dims: PanelDimensions,
	label: string,
	borderColor = THEME.BORDER_INACTIVE,
): Record<string, unknown> {
	return {
		left: dims.left,
		top: dims.top,
		width: dims.width,
		height: dims.height,
		label,
		tags: true,
		border: "line",
		style: {
			border: {
				fg: borderColor,
			},
			bg: "black",
			fg: "white",
		},
		scrollable: true,
		alwaysScroll: false,
		scrollbar: {
			ch: " ",
			inverse: true,
		},
	};
}
