// Context panel - warnings and forum status (prompt-only data not shown elsewhere)

import { applyBold, applyColor, COLORS } from "../colors";
import type { TuiContext } from "../index";

export function renderContextPanel(context: TuiContext | undefined): string {
	const lines: string[] = [];

	// Warnings section
	lines.push(applyColor(applyBold("== Warnings =="), COLORS.PANEL_TITLE));

	const warnings = context?.warnings;
	let hasWarnings = false;

	if (warnings?.stranded) {
		lines.push(applyColor("STRANDED: No fuel, no base", COLORS.STATUS_DANGER));
		hasWarnings = true;
	}

	if (warnings?.repetition) {
		lines.push(
			applyColor(
				`REPETITION: "${warnings.repetition.action}" x${warnings.repetition.count}`,
				COLORS.STATUS_WARNING,
			),
		);
		hasWarnings = true;
	}

	if (!hasWarnings) {
		lines.push(applyColor("None", COLORS.STATUS_INACTIVE));
	}

	lines.push("");

	// Forum section
	lines.push(applyColor(applyBold("== Forum =="), COLORS.PANEL_TITLE));

	const forum = context?.forum;
	const status = forum?.followUpStatus ?? null;
	const threadId = forum?.lastThreadId ?? null;
	const title = forum?.lastPostTitle ?? null;
	const category = forum?.lastPostCategory ?? null;

	if (status === "unread") {
		lines.push(applyColor("NEW THREAD - read now", COLORS.STATUS_WARNING));
	} else if (status === "periodic") {
		lines.push(applyColor("Active thread", COLORS.STATUS_SAFE));
	} else {
		lines.push(applyColor("No active thread", COLORS.STATUS_INACTIVE));
	}

	if (threadId) {
		lines.push(`Thread: ${threadId}`);
	} else if (title || category) {
		if (category && title) {
			lines.push(`[${category}] ${title}`);
		} else if (title) {
			lines.push(`Title: ${title}`);
		} else if (category) {
			lines.push(`Category: ${category}`);
		}
	}

	return lines.join("\n");
}
