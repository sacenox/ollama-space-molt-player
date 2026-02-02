// Panel for displaying current game activity with animated spinner and ASCII art

import type { GameStatusType } from "../../types";
import { ACTIVITY_ART, PALETTE, SYMBOLS, THEME } from "../theme";
import { applyBold, applyColor } from "../widgets";

export interface GameStatusData {
	activity: GameStatusType;
	details?: string | null;
	spinnerFrame: number;
}

/**
 * Strip blessed color tags to measure visual width
 */
function stripBlessedTags(text: string): string {
	return text.replace(/\{[^}]*\}/g, "");
}

/**
 * Get visual width of text (without color tags)
 */
function getVisualWidth(text: string): number {
	return stripBlessedTags(text).length;
}

function getActivityLabel(activity: GameStatusType): string {
	switch (activity) {
		case "waiting_for_tick":
			return "Waiting";
		case "requesting_action":
			return "Asking AI";
		case "llm_thinking":
			return "AI Thinking";
		case "traveling":
			return "Traveling";
		case "jumping":
			return "Jumping";
		case "processing_result":
			return "Processing";
		case "in_combat":
			return "COMBAT!";
		case "docked":
			return "Docked";
	}
}

function getActivityColor(activity: GameStatusType): string {
	switch (activity) {
		case "in_combat":
			return PALETTE.BRICK;
		case "traveling":
		case "jumping":
			return PALETTE.AMBER;
		case "docked":
			return PALETTE.MOSS;
		case "llm_thinking":
		case "requesting_action":
			return PALETTE.MOSS;
		default:
			return THEME.VALUE;
	}
}

function getActivityArt(activity: GameStatusType): string[] {
	return ACTIVITY_ART[activity];
}

function formatDetails(
	details: string | null | undefined,
	maxLen = 15,
): string {
	if (!details || !details.trim()) return "";
	const trimmed = details.trim();
	if (trimmed.length <= maxLen) return trimmed;
	return `${trimmed.slice(0, maxLen - 2)}..`;
}

export function renderGameStatusPanel(
	data: GameStatusData,
	panelWidth: number,
): string {
	const lines: string[] = [];
	const spinner = SYMBOLS.SPINNER_FRAMES[data.spinnerFrame];
	const activityLabel = getActivityLabel(data.activity);
	const activityColor = getActivityColor(data.activity);

	// Spinner + activity label
	const statusLine = `${applyColor(spinner, activityColor)} ${applyColor(applyBold(activityLabel), activityColor)}`;
	lines.push(statusLine);

	// Details (if available)
	if (data.details) {
		const detailsLabel =
			data.activity === "traveling" || data.activity === "jumping"
				? "to:"
				: data.activity === "docked"
					? "at:"
					: "";

		if (detailsLabel) {
			lines.push(applyColor(detailsLabel, THEME.LABEL));
			lines.push(applyColor(formatDetails(data.details, 15), THEME.VALUE));
		} else {
			lines.push(applyColor(formatDetails(data.details, 15), THEME.VALUE));
		}
	} else {
		// Add secondary info line for states without details
		const secondaryLine =
			data.activity === "waiting_for_tick"
				? "for tick"
				: data.activity === "requesting_action"
					? "for action"
					: data.activity === "llm_thinking"
						? "..."
						: "";
		if (secondaryLine) {
			lines.push(applyColor(secondaryLine, THEME.LABEL));
		}
	}

	// Add spacing
	lines.push("");

	// === ASCII ART WITH BORDER, SHADOW, AND CENTERING ===
	const art = getActivityArt(data.activity);

	// Use fixed maximum width for consistency across all activity states
	// All ASCII art is normalized to exactly 12 characters
	const FIXED_MAX_ART_WIDTH = 12;
	const maxArtWidth = FIXED_MAX_ART_WIDTH;

	// Border dimensions (2 spaces padding each side = comfortable)
	const padding = 2;
	const innerWidth = maxArtWidth + padding * 2;
	const borderWidth = innerWidth + 2; // +2 for │ │ borders

	// Create border components (simple style)
	const shadowChar = "░";
	const topBorder = `┌${"─".repeat(innerWidth)}┐`;
	const bottomBorder = `└${"─".repeat(innerWidth)}┘`;
	const bottomShadow = ` ${"░".repeat(borderWidth)}`; // Bottom shadow

	// Create bordered art lines with right shadow
	const borderedArt: string[] = [];
	for (const artLine of art) {
		const visualWidth = getVisualWidth(artLine);
		const leftPad = Math.floor((innerWidth - visualWidth) / 2);
		const rightPad = innerWidth - visualWidth - leftPad;
		const paddedLine = `│${" ".repeat(leftPad)}${artLine}${" ".repeat(rightPad)}│`;
		borderedArt.push(paddedLine);
	}

	// Calculate centering offset in panel
	const availableWidth = panelWidth - 2; // Account for blessed panel borders
	const centerOffset = Math.max(
		0,
		Math.floor((availableWidth - borderWidth) / 2),
	);
	const indent = " ".repeat(centerOffset);

	// Add bordered art with centering and 45-degree shadow
	// Top line: no shadow (shadow starts below)
	lines.push(indent + applyColor(topBorder, activityColor));

	// Content lines: shadow on right side
	for (const borderedLine of borderedArt) {
		lines.push(
			indent +
				applyColor(borderedLine, activityColor) +
				applyColor(shadowChar, PALETTE.GRAY),
		);
	}

	// Bottom border: shadow on right side
	lines.push(
		indent +
			applyColor(bottomBorder, activityColor) +
			applyColor(shadowChar, PALETTE.GRAY),
	);

	// Bottom shadow: full width to complete the 45-degree angle
	lines.push(indent + applyColor(bottomShadow, PALETTE.GRAY));

	return lines.join("\n");
}
