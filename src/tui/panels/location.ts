// Location and navigation panel (right top)

import type { POI, System } from "../../../client/src/types";
import { applyBold, applyColor, COLORS } from "../colors";
import { formatLine } from "../utils";

export interface LocationData {
	player: {
		current_system?: string;
		current_poi?: string;
		docked_at_base?: string | boolean | null;
	} | null;
	system: System | null;
	poi: POI | null;
	pois: Array<{ id: string; name: string; type?: string }>;
	traveling: boolean;
	travelTarget: string | null;
	jumping: boolean;
	jumpTarget: string | null;
}

export function renderLocationPanel(data: LocationData): string {
	if (!data.player) {
		return applyColor("Not logged in", COLORS.STATUS_INACTIVE);
	}

	const lines: string[] = [];

	// Current location
	lines.push(applyColor(applyBold("== Location =="), COLORS.PANEL_TITLE));

	const systemName = data.system?.name ?? data.player.current_system ?? "-";
	lines.push(formatLine("System", systemName, COLORS.PANEL_LABEL));

	const poiName = data.poi?.name ?? data.player.current_poi ?? "-";
	lines.push(formatLine("POI", poiName, COLORS.PANEL_LABEL));

	if (data.system?.police_level !== undefined) {
		const policeText = getPoliceLevel(data.system.police_level);
		lines.push(formatLine("Police", policeText, COLORS.PANEL_LABEL));
	}

	const docked = Boolean(data.player.docked_at_base);
	lines.push(formatLine("Docked", docked ? "Yes" : "No", COLORS.PANEL_LABEL));

	// Travel/jump status
	if (data.traveling) {
		const target = resolvePoiName(data.travelTarget, data.pois);
		lines.push(
			formatLine(
				"Status",
				applyColor(`Traveling to ${target}`, COLORS.STATUS_WARNING),
				COLORS.PANEL_LABEL,
			),
		);
	} else if (data.jumping) {
		const target = data.jumpTarget ?? "unknown";
		lines.push(
			formatLine(
				"Status",
				applyColor(`Jumping to ${target}`, COLORS.STATUS_WARNING),
				COLORS.PANEL_LABEL,
			),
		);
	}

	// POIs in system
	if (data.pois.length > 0) {
		lines.push("");
		lines.push(applyColor(applyBold("POIs in System"), COLORS.PANEL_LABEL));

		const maxPois = 6;
		for (const poi of data.pois.slice(0, maxPois)) {
			const name = poi.name || poi.id;
			const type = poi.type ? ` (${poi.type})` : "";
			lines.push(`  ${name}${type}`);
		}

		if (data.pois.length > maxPois) {
			const remaining = data.pois.length - maxPois;
			lines.push(applyColor(`  +${remaining} more`, COLORS.STATUS_INACTIVE));
		}
	}

	// System connections
	if (data.system?.connections && data.system.connections.length > 0) {
		lines.push("");
		lines.push(applyColor(applyBold("Connections"), COLORS.PANEL_LABEL));

		const maxConnections = 5;
		for (const conn of data.system.connections.slice(0, maxConnections)) {
			lines.push(`  → ${conn}`);
		}

		if (data.system.connections.length > maxConnections) {
			const remaining = data.system.connections.length - maxConnections;
			lines.push(applyColor(`  +${remaining} more`, COLORS.STATUS_INACTIVE));
		}
	}

	return lines.join("\n");
}

function getPoliceLevel(level: number): string {
	if (level === 0) return "None";
	if (level <= 3) return "Low";
	if (level <= 6) return "Medium";
	return "High";
}

function resolvePoiName(
	poiId: string | null,
	pois: Array<{ id: string; name: string }>,
): string {
	if (!poiId) return "unknown";
	const found = pois.find((p) => p.id === poiId);
	return found?.name ?? poiId;
}
