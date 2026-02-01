// Color scheme and theme configuration for TUI

export const COLORS = {
	// Panel styling
	PANEL_BORDER_ACTIVE: "cyan",
	PANEL_BORDER_INACTIVE: "blue",
	PANEL_TITLE: "cyan",
	PANEL_LABEL: "yellow",
	PANEL_VALUE: "white",

	// Status colors
	STATUS_SAFE: "green",
	STATUS_WARNING: "yellow",
	STATUS_DANGER: "red",
	STATUS_INACTIVE: "gray",

	// Message categories
	MSG_SUCCESS: "green",
	MSG_ERROR: "red",
	MSG_INFO: "white",
	MSG_AI: "cyan",
	MSG_CHAT: "yellow",
	MSG_TIMESTAMP: "gray",

	// Progress bars
	PROGRESS_HEALTHY: "green",
	PROGRESS_WARNING: "yellow",
	PROGRESS_CRITICAL: "red",

	// Background
	BG_DEFAULT: "black",
	BG_STATUS_BAR: "black",
} as const;

export const THRESHOLDS = {
	CRITICAL: 30, // % - below this is critical (red)
	WARNING: 60, // % - below this is warning (yellow)
	FUEL_LOW: 25, // % - fuel warning threshold
} as const;

export function applyColor(text: string, color: string): string {
	return `{${color}-fg}${text}{/${color}-fg}`;
}

export function applyBold(text: string): string {
	return `{bold}${text}{/bold}`;
}

export function applyBg(text: string, color: string): string {
	return `{${color}-bg}${text}{/${color}-bg}`;
}

export function getProgressColor(percentage: number): string {
	if (percentage < THRESHOLDS.CRITICAL) return COLORS.PROGRESS_CRITICAL;
	if (percentage < THRESHOLDS.WARNING) return COLORS.PROGRESS_WARNING;
	return COLORS.PROGRESS_HEALTHY;
}

export function getResourceColor(current: number, max: number): string {
	if (max <= 0) return COLORS.PROGRESS_CRITICAL;
	const percentage = (current / max) * 100;
	return getProgressColor(percentage);
}
