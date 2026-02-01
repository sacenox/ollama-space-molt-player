// Panel layout and positioning logic

export interface PanelDimensions {
	left: number;
	top: number;
	width: number | string;
	height: number | string;
}

export interface LayoutConfig {
	leftWidth: number; // Width percentage for left sidebar
	rightWidth: number; // Width percentage for right sidebar
	leftTopHeightPercent: number; // Percent of left sidebar for top panel
	leftMiddleHeightPercent: number; // Percent of left sidebar for middle panel
	rightTopHeightPercent: number; // Percent of right sidebar for top panel
}

export const DEFAULT_LAYOUT: LayoutConfig = {
	leftWidth: 20, // 20% for left sidebar
	rightWidth: 20, // 20% for right sidebar (center gets 60%)
	leftTopHeightPercent: 35, // 35% of left sidebar for player/ship panel
	leftMiddleHeightPercent: 35, // 35% of left sidebar for world info panel
	rightTopHeightPercent: 40, // 40% of right sidebar for tactical panel
};

export interface ComputedLayout {
	playerShip: PanelDimensions;
	worldInfo: PanelDimensions;
	log: PanelDimensions;
	location: PanelDimensions;
	tactical: PanelDimensions;
	context: PanelDimensions;
	statusBar: PanelDimensions;
}

export function computeLayout(
	termWidth: number,
	termHeight: number,
	config: LayoutConfig = DEFAULT_LAYOUT,
): ComputedLayout {
	// Minimum sizes to prevent panel collapse
	const MIN_SIDEBAR_WIDTH = 18;
	const MIN_CENTER_WIDTH = 40;
	const MIN_PANEL_HEIGHT = 5;

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

	// Height for panels (reserve 1 line for status bar)
	const availableHeight = termHeight - 1;

	// Left sidebar split into 3 panels: player/ship, world info, location
	const leftTopHeight = Math.max(
		MIN_PANEL_HEIGHT,
		Math.floor((availableHeight * config.leftTopHeightPercent) / 100),
	);
	const leftMiddleHeight = Math.max(
		MIN_PANEL_HEIGHT,
		Math.floor((availableHeight * config.leftMiddleHeightPercent) / 100),
	);
	const leftTopAdjusted = Math.min(
		leftTopHeight,
		availableHeight - MIN_PANEL_HEIGHT * 2,
	);
	const leftMiddleAdjusted = Math.min(
		leftMiddleHeight,
		availableHeight - leftTopAdjusted - MIN_PANEL_HEIGHT,
	);
	const leftBottomHeight = Math.max(
		MIN_PANEL_HEIGHT,
		availableHeight - leftTopAdjusted - leftMiddleAdjusted,
	);

	// Right sidebar split into 2 panels: tactical (40%), context (60%)
	const rightTopHeight = Math.max(
		MIN_PANEL_HEIGHT,
		Math.floor((availableHeight * config.rightTopHeightPercent) / 100),
	);
	const rightBottomHeight = Math.max(
		MIN_PANEL_HEIGHT,
		availableHeight - rightTopHeight,
	);

	return {
		playerShip: {
			left: 0,
			top: 0,
			width: leftWidthAbs,
			height: leftTopAdjusted,
		},
		worldInfo: {
			left: 0,
			top: leftTopAdjusted,
			width: leftWidthAbs,
			height: leftMiddleAdjusted,
		},
		log: {
			left: leftWidthAbs,
			top: 0,
			width: centerWidthAbs,
			height: availableHeight,
		},
		location: {
			left: 0,
			top: leftTopAdjusted + leftMiddleAdjusted,
			width: leftWidthAbs,
			height: leftBottomHeight,
		},
		tactical: {
			left: leftWidthAbs + centerWidthAbs,
			top: 0,
			width: rightWidthAbs,
			height: rightTopHeight,
		},
		context: {
			left: leftWidthAbs + centerWidthAbs,
			top: rightTopHeight,
			width: rightWidthAbs,
			height: rightBottomHeight,
		},
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
	borderColor = "blue",
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
