// Tactical panel (right top) - combat status or nearby players

import { PALETTE, THEME } from "../theme";
import {
	applyBold,
	applyColor,
	renderBar,
	renderKv,
	renderSectionTitle,
} from "../widgets";

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
	nearby: Array<{
		player_id?: string;
		username?: string;
		ship_class?: string;
		faction_tag?: string;
	}>;
}

export function renderTacticalPanel(data: TacticalData): string {
	const lines: string[] = [];

	if (data.inCombat && data.combatTarget) {
		// Combat mode
		lines.push(applyColor(applyBold(" !! COMBAT ALERT !! "), PALETTE.BRICK));
		lines.push("");

		const targetName = data.combatTarget.username ?? data.combatTarget.id;
		lines.push(renderKv("TARGET", applyBold(targetName)));
		lines.push("");

		if (
			data.combatTarget.hull !== undefined &&
			data.combatTarget.maxHull !== undefined
		) {
			lines.push(
				renderBar("HULL", data.combatTarget.hull, data.combatTarget.maxHull),
			);
		}
		if (
			data.combatTarget.shield !== undefined &&
			data.combatTarget.maxShield !== undefined
		) {
			lines.push(
				renderBar(
					"SHIELD",
					data.combatTarget.shield,
					data.combatTarget.maxShield,
				),
			);
		}
	} else {
		// Safe mode - show nearby players
		lines.push(renderSectionTitle("TACTICAL SCANNER"));

		lines.push(renderKv("Status", applyColor("SAFE", THEME.SAFE)));
		lines.push(renderKv("Entities", data.nearby.length));
		lines.push("");

		if (data.nearby.length > 0) {
			lines.push(applyColor("NEARBY SIGNALS:", THEME.LABEL));

			const maxShow = 8;
			for (const player of data.nearby.slice(0, maxShow)) {
				const name = player.username ?? player.player_id ?? "Unknown";
				const ship = player.ship_class ? `[${player.ship_class}]` : "";
				const faction = player.faction_tag ? `<${player.faction_tag}>` : "";

				// Format: Name <Faction> [Ship]
				let line = ` ${name}`;
				if (faction) line += ` ${applyColor(faction, PALETTE.GRAY)}`;
				if (ship) line += ` ${applyColor(ship, THEME.INACTIVE)}`;

				lines.push(line);
			}

			if (data.nearby.length > maxShow) {
				const remaining = data.nearby.length - maxShow;
				lines.push(
					applyColor(` ... and ${remaining} more signals`, THEME.INACTIVE),
				);
			}
		} else {
			lines.push(applyColor(" No active signatures detected.", THEME.INACTIVE));
		}
	}

	return lines.join("\n");
}
