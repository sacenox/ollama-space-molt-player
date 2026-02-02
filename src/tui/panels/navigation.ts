// Navigation and local environment panel

import type { Base, POI, System } from "../../../client/src/types";
import { PALETTE, THEME } from "../theme";
import {
	applyBold,
	applyColor,
	renderKv,
	renderSectionTitle,
} from "../widgets";

export interface NavigationData {
	player: {
		current_system?: string;
		current_poi?: string;
		docked_at_base?: string | boolean | null;
	} | null;
	system: System | null;
	poi: POI | null;
	base: Base | null;
	pois: Array<{ id: string; name: string; type?: string }>;
	traveling: boolean;
	travelTarget: string | null;
	jumping: boolean;
	jumpTarget: string | null;
}

export function renderNavigationPanel(data: NavigationData): string {
	if (!data.player) return "";

	const lines: string[] = [];

	// -- System Info --
	lines.push(renderSectionTitle("LOCATION"));
	const sysName = data.system?.name ?? data.player.current_system ?? "Unknown";
	lines.push(renderKv("System", applyBold(sysName)));

	const poiName = data.poi?.name ?? data.player.current_poi ?? "Deep Space";
	lines.push(renderKv("POI", poiName));

	if (data.system?.police_level !== undefined) {
		const police = getPoliceLevel(data.system.police_level);
		lines.push(renderKv("Security", police));
	}

	// -- Status --
	if (data.traveling) {
		lines.push("");
		lines.push(
			applyColor(
				`» Traveling to ${data.travelTarget || "destination"}...`,
				PALETTE.AMBER,
			),
		);
	} else if (data.jumping) {
		lines.push("");
		lines.push(
			applyColor(
				`» Jumping to ${data.jumpTarget || "system"}...`,
				PALETTE.AMBER,
			),
		);
	}

	// -- Base Info (if docked) --
	if (data.base || data.player.docked_at_base) {
		lines.push(renderSectionTitle("DOCKED AT BASE"));
		if (data.base) {
			lines.push(renderKv("Name", data.base.name || data.base.id));
			if (data.base.empire) lines.push(renderKv("Owner", data.base.empire));

			lines.push(applyColor("Services:", THEME.LABEL));
			const services = Object.entries(data.base.services)
				.filter(([_, active]) => active)
				.map(([name]) => name);

			if (services.length > 0) {
				const joined = services.join(", ");
				lines.push(applyColor(` ${joined}`, THEME.VALUE));
			} else {
				lines.push(applyColor(" None", THEME.INACTIVE));
			}

			// Market Data
			if (data.base.market && data.base.market.length > 0) {
				lines.push("");
				lines.push(applyColor("Market:", THEME.LABEL));
				for (const item of data.base.market.slice(0, 10)) {
					const name = item.item_id;
					const price = item.price_each;
					const qty = item.quantity;
					lines.push(` ${applyColor(name, THEME.VALUE)}: ${price}cr (x${qty})`);
				}
				if (data.base.market.length > 10) {
					lines.push(
						applyColor(
							` ... +${data.base.market.length - 10} items`,
							THEME.INACTIVE,
						),
					);
				}
			}
		} else {
			lines.push(applyColor("Downloading base info...", THEME.INACTIVE));
		}
	} else {
		// Not docked - Show POIs and Connections
		if (data.pois.length > 0) {
			lines.push(renderSectionTitle("SYSTEM POIS"));
			for (const poi of data.pois.slice(0, 8)) {
				const name = poi.name || poi.id;
				const type = poi.type ? `(${poi.type})` : "";
				lines.push(` ${name} ${applyColor(type, THEME.INACTIVE)}`);
			}
			if (data.pois.length > 8) {
				lines.push(
					applyColor(` ... +${data.pois.length - 8} more`, THEME.INACTIVE),
				);
			}
		}

		if (data.system?.connections && data.system.connections.length > 0) {
			lines.push(renderSectionTitle("CONNECTIONS"));
			for (const conn of data.system.connections) {
				lines.push(` » ${conn}`);
			}
		}
	}

	return lines.join("\n");
}

function getPoliceLevel(level: number): string {
	if (level === 0) return "Anarchy (0)";
	if (level <= 3) return "Low (1-3)";
	if (level <= 6) return "Medium (4-6)";
	return "High (7+)";
}
