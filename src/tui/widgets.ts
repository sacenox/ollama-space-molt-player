import { SYMBOLS, THEME } from "./theme";

export function applyColor(text: string, color: string): string {
	return `{${color}-fg}${text}{/${color}-fg}`;
}

export function applyBold(text: string): string {
	return `{bold}${text}{/bold}`;
}

/**
 * Renders a key-value pair with consistent spacing.
 * @param label The label text
 * @param value The value text
 * @param labelWidth Width to pad the label to (default: 12)
 */
export function renderKv(
	label: string,
	value: string | number,
	labelWidth = 12,
): string {
	const paddedLabel = `${label}:`.padEnd(labelWidth);
	return `${applyColor(paddedLabel, THEME.LABEL)} ${value}`;
}

/**
 * Renders a styled section header.
 * @param title Section title
 */
export function renderSectionTitle(title: string): string {
	return `\n${applyColor(applyBold(`== ${title} ==`), THEME.TITLE)}`;
}

/**
 * Renders a progress bar using block characters.
 * @param label Label for the bar
 * @param current Current value
 * @param max Max value
 * @param width Total width of the bar (characters)
 */
export function renderBar(
	label: string,
	current: number,
	max: number,
	width = 20,
): string {
	const safeMax = Math.max(max, 1);
	const ratio = Math.min(Math.max(current / safeMax, 0), 1);
	const filledLen = Math.floor(ratio * width);
	const emptyLen = width - filledLen;

	let barColor = THEME.BAR_FILLED;
	if (ratio < 0.3) barColor = THEME.BAR_CRITICAL;
	else if (ratio < 0.6) barColor = THEME.BAR_WARNING;

	const barStr =
		applyColor(SYMBOLS.BAR_FULL.repeat(filledLen), barColor) +
		applyColor(SYMBOLS.BAR_EMPTY.repeat(emptyLen), THEME.BAR_EMPTY);

	const percentage = Math.round(ratio * 100);
	const labelStr = applyColor(label.padEnd(8), THEME.LABEL);

	return `${labelStr} ${barStr} ${percentage}%`;
}

/**
 * Renders a simple list item with a bullet.
 */
export function renderListItem(
	text: string,
	color: string = THEME.VALUE,
): string {
	return `${applyColor(SYMBOLS.BULLET, THEME.BORDER_INACTIVE)} ${applyColor(text, color)}`;
}
