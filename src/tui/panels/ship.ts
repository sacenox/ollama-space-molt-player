// Ship status and cargo panel

import type { Ship } from "../../../client/src/types";
import { THEME } from "../theme";
import {
	applyColor,
	renderBar,
	renderKv,
	renderSectionTitle,
} from "../widgets";

export interface ShipData {
	ship: Ship | null;
}

export function renderShipPanel(data: ShipData): string {
	if (!data.ship) {
		return applyColor("No ship data", THEME.INACTIVE);
	}

	const s = data.ship;
	const lines: string[] = [];

	lines.push(renderSectionTitle("SHIP STATUS"));
	lines.push(renderKv("Class", s.name || s.class_id));
	lines.push(renderKv("Speed", s.speed));
	lines.push(renderKv("Armor", s.armor));

	lines.push("");
	lines.push(renderBar("Hull", s.hull, s.max_hull));
	lines.push(renderBar("Shield", s.shield, s.max_shield));
	lines.push(renderBar("Fuel", s.fuel, s.max_fuel));

	lines.push(renderSectionTitle("CARGO"));
	lines.push(renderBar("Hold", s.cargo_used, s.cargo_capacity));

	if (s.cargo && s.cargo.length > 0) {
		lines.push("");
		for (const item of s.cargo) {
			const label = item.item_id.padEnd(14);
			const val = `x${item.quantity}`;
			lines.push(
				`${applyColor(label, THEME.LABEL)} ${applyColor(val, THEME.VALUE)}`,
			);
		}
	} else {
		lines.push(applyColor("  (Empty)", THEME.INACTIVE));
	}

	return lines.join("\n");
}
