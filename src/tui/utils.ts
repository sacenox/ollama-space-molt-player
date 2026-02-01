// Shared TUI utility functions

import { applyColor, COLORS, getResourceColor } from "./colors";

export function formatLine(
	label: string,
	value: string,
	labelColor: string,
): string {
	return `${applyColor(label, labelColor)}: ${value}`;
}

export function truncate(value: string, maxLen: number): string {
	if (value.length <= maxLen) return value.padEnd(maxLen);
	return `${value.slice(0, maxLen - 2)}..`;
}

export function formatResourceBar(
	label: string,
	current: number,
	max: number,
	barLength = 10,
	labelColor: string = COLORS.PANEL_LABEL,
): string {
	const percentage = max > 0 ? (current / max) * 100 : 0;
	const filled = Math.round((percentage / 100) * barLength);
	const empty = barLength - filled;

	const bar = "█".repeat(filled) + "░".repeat(empty);
	const color = getResourceColor(current, max);
	const pct = Math.round(percentage);

	const labelPart = applyColor(label, labelColor);
	const barPart = applyColor(bar, color);
	const valuePart = `${current}/${max} (${pct}%)`;

	return `${labelPart}: ${barPart} ${valuePart}`;
}
