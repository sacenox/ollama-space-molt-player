// Panel for displaying the result of the last action

import { PALETTE, THEME } from "../theme";
import { applyBold, applyColor } from "../widgets";

export function renderActionResultPanel(
	lastActionResult: string | null | undefined,
): string {
	if (!lastActionResult || !lastActionResult.trim()) {
		return applyColor("No recent actions.", THEME.INACTIVE);
	}

	const lines: string[] = [];
	const raw = lastActionResult.trim();

	// Try to parse standard format "Action: ... \n Result: ..."
	// If it matches, we can style it better.

	const parts = raw.split("\n");

	for (const line of parts) {
		if (line.startsWith("Action:")) {
			// Highlight the action header
			lines.push(applyColor(applyBold(line), PALETTE.AMBER));
		} else if (line.startsWith("Result:")) {
			lines.push(applyColor(line, THEME.LABEL));
		} else if (line.trim().startsWith("- ERROR")) {
			lines.push(applyColor(line, PALETTE.BRICK));
		} else if (line.trim().startsWith("-")) {
			// Bullet points
			lines.push(applyColor(line, PALETTE.WHITE));
		} else {
			lines.push(applyColor(line, THEME.VALUE));
		}
	}

	return lines.join("\n");
}
