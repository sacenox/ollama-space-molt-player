// Tactical panel (right bottom) - combat status or nearby players

import { applyBold, applyColor, COLORS } from "../colors";
import { formatLine, formatResourceBar } from "../utils";

export interface TacticalData {
	inCombat: boolean;
	combatTarget?: {
		id: string;
		username?: string;
		hull?: number;
		maxHull?: number;
		shield?: number;
		maxShield?: number;
	};
	nearby: Array<{ player_id?: string; username?: string }>;
}

export function renderTacticalPanel(data: TacticalData): string {
	const lines: string[] = [];

	if (data.inCombat && data.combatTarget) {
		// Combat mode
		lines.push(applyColor(applyBold("== COMBAT =="), COLORS.STATUS_DANGER));

		const targetName = data.combatTarget.username ?? data.combatTarget.id;
		lines.push(formatLine("Target", targetName, COLORS.PANEL_LABEL));

		lines.push("");

		// Target health
		if (
			data.combatTarget.hull !== undefined &&
			data.combatTarget.maxHull !== undefined
		) {
			lines.push(
				formatHealthBar(
					"Hull",
					data.combatTarget.hull,
					data.combatTarget.maxHull,
				),
			);
		}

		if (
			data.combatTarget.shield !== undefined &&
			data.combatTarget.maxShield !== undefined
		) {
			lines.push(
				formatHealthBar(
					"Shield",
					data.combatTarget.shield,
					data.combatTarget.maxShield,
				),
			);
		}
	} else {
		// Safe mode - show nearby players
		lines.push(applyColor(applyBold("== Tactical =="), COLORS.PANEL_TITLE));

		lines.push(
			formatLine(
				"Status",
				applyColor("Safe", COLORS.STATUS_SAFE),
				COLORS.PANEL_LABEL,
			),
		);

		if (data.nearby.length > 0) {
			lines.push("");
			lines.push(applyColor(applyBold("Nearby Players"), COLORS.PANEL_LABEL));
			lines.push(
				formatLine("Count", String(data.nearby.length), COLORS.PANEL_LABEL),
			);

			const maxShow = 6;
			for (const player of data.nearby.slice(0, maxShow)) {
				const name = player.username ?? player.player_id ?? "unknown";
				lines.push(`  ${name}`);
			}

			if (data.nearby.length > maxShow) {
				const remaining = data.nearby.length - maxShow;
				lines.push(applyColor(`  +${remaining} more`, COLORS.STATUS_INACTIVE));
			}
		} else {
			lines.push("");
			lines.push(applyColor("No nearby players", COLORS.STATUS_INACTIVE));
		}
	}

	return lines.join("\n");
}

function formatHealthBar(label: string, current: number, max: number): string {
	// Use shared utility but override the value format to show percentage only
	const bar = formatResourceBar(label, current, max);
	// Extract just percentage for compact display
	return bar.replace(/\d+\/\d+ \((\d+%)\)/, "$1");
}
