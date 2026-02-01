// Player and Ship status panel (left top)

import type { Player, Ship } from "../../../client/src/types";
import type { PersonalityType } from "../../actions";
import { PERSONALITY_ARCHETYPES } from "../../actions";
import { ALIGNMENT_DESCRIPTIONS } from "../../constants";
import type { AlignmentType } from "../../types";
import { applyBold, applyColor, COLORS } from "../colors";
import { formatLine, formatResourceBar } from "../utils";

export interface PlayerShipData {
	player: Player | null;
	ship: Ship | null;
	alignment?: AlignmentType;
	personality?: PersonalityType;
	tick: number;
}

export function renderPlayerShipPanel(data: PlayerShipData): string {
	if (!data.player || !data.ship) {
		return applyColor("Not logged in", COLORS.STATUS_INACTIVE);
	}

	const lines: string[] = [];

	// Player info
	lines.push(applyColor(applyBold("== Player =="), COLORS.PANEL_TITLE));
	lines.push(formatLine("Name", data.player.username, COLORS.PANEL_LABEL));
	lines.push(formatLine("Empire", data.player.empire, COLORS.PANEL_LABEL));

	if (data.alignment) {
		const alignInfo = ALIGNMENT_DESCRIPTIONS[data.alignment];
		lines.push(formatLine("Alignment", alignInfo.name, COLORS.PANEL_LABEL));
	}

	if (data.personality) {
		const info = PERSONALITY_ARCHETYPES[data.personality];
		lines.push(formatLine("Role", `${info.name}`, COLORS.PANEL_LABEL));
	}

	lines.push(
		formatLine(
			"Credits",
			formatNumber(data.player.credits),
			COLORS.PANEL_LABEL,
		),
	);
	lines.push(
		formatLine(
			"Docked",
			data.player.docked_at_base ? "Yes" : "No",
			COLORS.PANEL_LABEL,
		),
	);

	lines.push("");

	// Ship info
	lines.push(applyColor(applyBold("== Ship =="), COLORS.PANEL_TITLE));
	lines.push(formatLine("Name", data.ship.name, COLORS.PANEL_LABEL));
	lines.push(formatLine("Class", data.ship.class_id, COLORS.PANEL_LABEL));

	lines.push("");

	// Resources with progress bars
	lines.push(formatResourceBar("Hull", data.ship.hull, data.ship.max_hull));
	lines.push(
		formatResourceBar("Shield", data.ship.shield, data.ship.max_shield),
	);
	lines.push(formatResourceBar("Fuel", data.ship.fuel, data.ship.max_fuel));
	lines.push(
		formatResourceBar("Cargo", data.ship.cargo_used, data.ship.cargo_capacity),
	);

	lines.push("");
	lines.push(formatLine("Speed", String(data.ship.speed), COLORS.PANEL_LABEL));
	lines.push(formatLine("Armor", String(data.ship.armor), COLORS.PANEL_LABEL));

	return lines.join("\n");
}

function formatNumber(num: number): string {
	return num.toLocaleString();
}
