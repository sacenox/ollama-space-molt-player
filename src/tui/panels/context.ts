// Context panel - warnings, memory summary, and forum status

import { truncateThinking } from "../../utils";
import type { TuiContext } from "../index";
import { PALETTE, THEME } from "../theme";
import { applyColor, renderSectionTitle } from "../widgets";

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
		const truncated = truncateThinking(thinking, 500);
		lines.push(applyColor(truncated, THEME.VALUE));
	}

	return lines.join("\n");
}
