// Context panel - warnings, memory summary, and forum status

import type { TuiContext } from "../index";
import { PALETTE, THEME } from "../theme";
import { applyColor, renderSectionTitle } from "../widgets";

function truncateThinking(text: string, maxChars = 200): string {
	const trimmed = text.trim();

	// If short enough, return as-is
	if (trimmed.length <= maxChars) {
		return trimmed;
	}

	// Try sentence-based approach
	const sentences = trimmed.match(/[^.!?]+[.!?]+/g);

	if (sentences && sentences.length > 0) {
		// Collect sentences from end backwards
		const collected: string[] = [];
		let totalLength = 0;

		for (let i = sentences.length - 1; i >= 0; i--) {
			const sentence = sentences[i].trim();
			const newLength =
				totalLength + sentence.length + (collected.length > 0 ? 1 : 0); // +1 for space

			if (newLength > maxChars) {
				break;
			}

			collected.unshift(sentence);
			totalLength = newLength;
		}

		if (collected.length > 0) {
			const result = collected.join(" ");
			const isPartial = collected.length < sentences.length;
			return isPartial ? `[...] ${result}` : result;
		}
	}

	// Fallback: character truncation
	const excerpt = trimmed.slice(-maxChars).trim();
	return `[...] ${excerpt}`;
}

export function renderContextPanel(context: TuiContext | undefined): string {
	const lines: string[] = [];

	// Warnings section
	const warnings = context?.warnings;
	if (warnings?.stranded || warnings?.repetition) {
		lines.push(renderSectionTitle("ALERTS"));
		if (warnings?.stranded) {
			lines.push(applyColor("!! STRANDED !!", PALETTE.BRICK));
			lines.push("No fuel, no base nearby.");
		}
		if (warnings?.repetition) {
			lines.push(applyColor("!! REPETITION DETECTED !!", PALETTE.AMBER));
			lines.push(
				`Action "${warnings.repetition.action}" repeated x${warnings.repetition.count}`,
			);
		}
		lines.push("");
	}

	// Forum status
	const forum = context?.forum;
	if (forum?.followUpStatus === "unread") {
		lines.push(renderSectionTitle("COMMUNICATIONS"));
		lines.push(applyColor(" [!] Unread Forum Reply", PALETTE.AMBER));
		if (forum.lastThreadId) lines.push(` Thread: ${forum.lastThreadId}`);
		lines.push("");
	}

	// Memory summary section
	lines.push(renderSectionTitle("SHORT-TERM MEMORY"));
	const memorySummary = context?.memorySummary?.trim();
	if (memorySummary) {
		// Just output the text, let blessed wrap it
		lines.push(applyColor(memorySummary, THEME.VALUE));
	} else {
		lines.push(applyColor("No memory available.", THEME.INACTIVE));
	}

	// Thinking section
	const thinking = context?.thinking?.trim();
	if (thinking) {
		lines.push("");
		lines.push(renderSectionTitle("CURRENT THINKING"));
		const truncated = truncateThinking(thinking, 200);
		lines.push(applyColor(truncated, THEME.VALUE));
	}

	return lines.join("\n");
}
