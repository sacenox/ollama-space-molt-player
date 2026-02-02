// Panel for displaying the result of the last action with enhanced visuals

import type { ActionHistoryEntry } from "../../types";
import { PALETTE, SYMBOLS, THEME } from "../theme";
import { applyBold, applyColor } from "../widgets";

type ActionCategory = "navigation" | "resource" | "combat" | "info" | "social";

/**
 * Strip blessed color tags to measure visual width
 * Example: "{red-fg}hello{/red-fg}" -> "hello"
 */
function stripBlessedTags(text: string): string {
	return text.replace(/\{[^}]*\}/g, "");
}

/**
 * Calculate visual width (actual displayed characters)
 */
function getVisualWidth(text: string): number {
	return stripBlessedTags(text).length;
}

/**
 * Pad text to target width by adding spaces on right
 * Preserves blessed tags but ensures visual width matches target
 */
function padToWidth(text: string, targetWidth: number): string {
	const visualWidth = getVisualWidth(text);
	const spacesNeeded = Math.max(0, targetWidth - visualWidth);
	return text + " ".repeat(spacesNeeded);
}

/**
 * Create a content line with colored borders
 * Pads content first, then adds colored borders
 */
function createBorderedLine(
	content: string,
	contentWidth: number,
	borderColor: string,
	indent: string,
): string {
	const paddedContent = padToWidth(content, contentWidth);
	return (
		indent +
		applyColor("║", borderColor) +
		paddedContent +
		applyColor("║", borderColor)
	);
}

function detectActionCategory(actionLine: string): ActionCategory {
	const lower = actionLine.toLowerCase();

	if (
		lower.includes("travel") ||
		lower.includes("jump") ||
		lower.includes("dock") ||
		lower.includes("undock") ||
		lower.includes("arrived") ||
		lower.includes("jumped")
	) {
		return "navigation";
	}

	if (
		lower.includes("mine") ||
		lower.includes("buy") ||
		lower.includes("sell") ||
		lower.includes("refuel") ||
		lower.includes("repair")
	) {
		return "resource";
	}

	if (
		lower.includes("attack") ||
		lower.includes("scan") ||
		lower.includes("combat")
	) {
		return "combat";
	}

	if (
		lower.includes("forum") ||
		lower.includes("chat") ||
		lower.includes("say") ||
		lower.includes("faction") ||
		lower.includes("msg")
	) {
		return "social";
	}

	return "info";
}

function getCategoryLabel(category: ActionCategory): string {
	switch (category) {
		case "navigation":
			return "NAVIGATION";
		case "resource":
			return "TRADE";
		case "combat":
			return "COMBAT";
		case "social":
			return "SOCIAL";
		case "info":
			return "STATUS";
	}
}

function getCategoryBlock(category: ActionCategory): string {
	switch (category) {
		case "navigation":
			return SYMBOLS.NAV_BLOCK;
		case "resource":
			return SYMBOLS.RESOURCE_BLOCK;
		case "combat":
			return SYMBOLS.COMBAT_BLOCK;
		case "social":
			return SYMBOLS.INFO_BLOCK;
		case "info":
			return SYMBOLS.INFO_BLOCK;
	}
}

function getCategoryColor(category: ActionCategory): string {
	switch (category) {
		case "navigation":
			return PALETTE.AMBER;
		case "resource":
			return PALETTE.MOSS;
		case "combat":
			return PALETTE.BRICK;
		case "social":
			return PALETTE.ORANGE;
		case "info":
			return PALETTE.WHITE;
	}
}

function hasError(lines: string[]): boolean {
	return lines.some((line) => line.trim().startsWith("- ERROR"));
}

function buildFrame(
	category: ActionCategory,
	hasError: boolean,
	panelWidth: number,
): { top: string; bottom: string; contentWidth: number; indent: string } {
	const block = getCategoryBlock(category);
	const label = getCategoryLabel(category);
	const color = hasError ? PALETTE.BRICK : getCategoryColor(category);

	// Calculate frame width with padding from panel borders
	// panelWidth includes blessed borders (2 chars) + scrollbar (1 char when active)
	// We need: left padding (1) + our borders (2) + content + scrollbar (1) + blessed border (implied)
	const BLESSED_BORDERS = 2;
	const SCROLLBAR_WIDTH = 1;
	const LEFT_PADDING = 1;
	const RIGHT_MARGIN = 2; // Extra safety margin
	const frameWidth = Math.max(
		20,
		panelWidth -
			BLESSED_BORDERS -
			SCROLLBAR_WIDTH -
			LEFT_PADDING -
			RIGHT_MARGIN,
	);

	// Content width is what's available inside our custom borders
	const contentWidth = frameWidth - 2; // Minus our ║║ borders
	const indent = " "; // 1 space indent for left padding

	// Top: ╔═══ LABEL ═══...╗
	const labelPart = ` ${label} `;
	const blockCount = 3;
	const leftBlocks = block.repeat(blockCount);

	// Calculate remaining space for right blocks
	const innerWidth = frameWidth - 2; // Space between ╔ and ╗
	const usedWidth = blockCount + labelPart.length; // Left blocks + label
	const remainingWidth = Math.max(0, innerWidth - usedWidth); // Space for right blocks
	const rightBlocks = block.repeat(remainingWidth);

	const topLine = `╔${leftBlocks}${labelPart}${rightBlocks}╗`;
	const bottomLine = `╚${"═".repeat(frameWidth - 2)}╝`;

	return {
		top: applyColor(topLine, color),
		bottom: applyColor(bottomLine, color),
		contentWidth,
		indent,
	};
}

function renderSingleResult(
	result: string,
	category: ActionCategory,
	hasErr: boolean,
	panelWidth: number,
	isLatest = false,
): string[] {
	const lines: string[] = [];
	const frame = buildFrame(category, hasErr, panelWidth);
	const { contentWidth, indent } = frame;
	const borderColor = hasErr ? PALETTE.BRICK : getCategoryColor(category);

	// Add top border with indent
	lines.push(indent + frame.top);

	// Add top padding (blank line WITH borders)
	lines.push(createBorderedLine("", contentWidth, borderColor, indent));

	// Process content lines
	const parts = result.trim().split("\n");
	for (const line of parts) {
		if (line.startsWith("Action:")) {
			// Action header - extract just the action part
			const actionText = line.replace(/^Action:\s*/, "");
			const symbol = hasErr ? SYMBOLS.ERROR : SYMBOLS.SUCCESS;
			const symbolColor = hasErr ? PALETTE.BRICK : PALETTE.MOSS;
			const latestBadge = isLatest ? " [LATEST]" : "";

			// Calculate available space: "   ✓ " = 5 chars, latestBadge = 9 chars (if present)
			const prefixLen = 5; // "   ✓ "
			const badgeLen = latestBadge.length;
			const breathingRoom = 2; // Minimum spaces before closing ║
			const maxActionLen = contentWidth - prefixLen - badgeLen - breathingRoom;

			// Truncate actionText if needed (subtract 3 for "...")
			const truncatedAction =
				actionText.length > maxActionLen
					? actionText.substring(0, maxActionLen - 3) + "..."
					: actionText;

			const content = `   ${applyColor(symbol, symbolColor)} ${applyColor(truncatedAction, THEME.VALUE)}${isLatest ? applyColor(applyBold(latestBadge), PALETTE.AMBER) : ""}`;
			lines.push(
				createBorderedLine(content, contentWidth, borderColor, indent),
			);
		} else if (line.startsWith("Result:")) {
			// Skip "Result:" header
		} else if (line.trim().startsWith("- ERROR")) {
			const errorText = line.replace(/^\s*-\s*ERROR:?\s*/, "").trim();
			const prefixLen = 5; // "     "
			const maxLen = contentWidth - prefixLen;
			const truncated =
				errorText.length > maxLen
					? errorText.substring(0, maxLen - 3) + "..."
					: errorText;
			const content = `     ${applyColor(truncated, PALETTE.BRICK)}`;
			lines.push(
				createBorderedLine(content, contentWidth, borderColor, indent),
			);
		} else if (line.trim().startsWith("- ")) {
			// Bullet points
			const bulletText = line.replace(/^\s*-\s*/, "");
			const prefixLen = 5; // "     "
			const maxLen = contentWidth - prefixLen;
			const truncated =
				bulletText.length > maxLen
					? bulletText.substring(0, maxLen - 3) + "..."
					: bulletText;
			const content = `     ${applyColor(truncated, THEME.VALUE)}`;
			lines.push(
				createBorderedLine(content, contentWidth, borderColor, indent),
			);
		} else if (line.trim().startsWith("->")) {
			// Solution/guidance
			const guideText = line.replace(/^\s*->\s*/, "");
			// Visual layout: "     → text" = 5 spaces + arrow + space + text
			// We build: "     " + applyColor("→ " + text)
			// So: contentWidth = 5 + 1 + 1 + text.length
			const INDENT = 5; // "     "
			const ARROW_AND_SPACE = 2; // "→ "
			const maxTextLen = contentWidth - INDENT - ARROW_AND_SPACE;
			const truncated =
				guideText.length > maxTextLen
					? guideText.substring(0, maxTextLen - 3) + "..."
					: guideText;
			const content = `     ${applyColor(`→ ${truncated}`, PALETTE.MOSS)}`;
			lines.push(
				createBorderedLine(content, contentWidth, borderColor, indent),
			);
		} else if (line.trim()) {
			// Other content
			const text = line.trim();
			const prefixLen = 5; // "     "
			const maxLen = contentWidth - prefixLen;
			const truncated =
				text.length > maxLen ? text.substring(0, maxLen - 3) + "..." : text;
			const content = `     ${applyColor(truncated, THEME.VALUE)}`;
			lines.push(
				createBorderedLine(content, contentWidth, borderColor, indent),
			);
		}
	}

	// Add bottom padding (blank line WITH borders)
	lines.push(createBorderedLine("", contentWidth, borderColor, indent));

	// Add bottom border with indent
	lines.push(indent + frame.bottom);

	return lines;
}

export function renderActionResultPanel(
	history: ActionHistoryEntry[],
	panelWidth: number,
): string {
	if (!history || history.length === 0) {
		return applyColor("No recent actions.", THEME.INACTIVE);
	}

	const allLines: string[] = [];

	// Render each action in history (most recent first)
	for (let i = 0; i < history.length; i++) {
		const entry = history[i];
		const parts = entry.result.trim().split("\n");
		const actionLine = parts.find((line) => line.startsWith("Action:")) || "";
		const category = detectActionCategory(actionLine);
		const hasErr = hasError(parts);
		const isLatest = i === 0;

		const resultLines = renderSingleResult(
			entry.result,
			category,
			hasErr,
			panelWidth,
			isLatest,
		);

		allLines.push(...resultLines);

		// Add single blank line between entries (except after last one)
		if (i < history.length - 1) {
			allLines.push("");
		}
	}

	return allLines.join("\n");
}
