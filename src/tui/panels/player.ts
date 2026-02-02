// Player identity and status panel

import type { Player } from "../../../client/src/types";
import type { PersonalityType } from "../../actions";
import { PERSONALITY_ARCHETYPES } from "../../actions";
import { ALIGNMENT_DESCRIPTIONS } from "../../constants";
import type { AlignmentType } from "../../types";
import { PALETTE, THEME } from "../theme";
import {
	applyBold,
	applyColor,
	renderKv,
	renderSectionTitle,
} from "../widgets";

export interface PlayerData {
	player: Player | null;
	alignment?: AlignmentType;
	personality?: PersonalityType;
	tick: number;
	currentMission: string | null;
}

export function renderPlayerPanel(data: PlayerData): string {
	if (!data.player) {
		return applyColor("Waiting for login...", THEME.INACTIVE);
	}

	const lines: string[] = [];

	// Identity
	lines.push(renderSectionTitle("IDENTITY"));
	lines.push(renderKv("Name", applyBold(data.player.username)));
	lines.push(renderKv("Empire", data.player.empire));

	if (data.alignment) {
		const alignInfo = ALIGNMENT_DESCRIPTIONS[data.alignment];
		lines.push(renderKv("Align", alignInfo.name));
	}

	if (data.personality) {
		const info = PERSONALITY_ARCHETYPES[data.personality];
		lines.push(renderKv("Role", info.name));
	}

	// Status
	lines.push(renderSectionTitle("STATUS"));
	lines.push(renderKv("Credits", `${data.player.credits.toLocaleString()}cr`));
	lines.push(
		renderKv(
			"Docked",
			data.player.docked_at_base ? applyColor("YES", THEME.SAFE) : "NO",
		),
	);

	const factionTag = data.player.clan_tag || "None";
	lines.push(renderKv("Faction", factionTag));

	// Mission (Prominent)
	lines.push(renderSectionTitle("CURRENT MISSION"));
	if (data.currentMission) {
		const missionText = data.currentMission.trim();
		// Wrap text slightly for better reading if needed, but blessed handles wrapping too.
		// We'll apply a color to make it stand out.
		lines.push(applyColor(missionText, PALETTE.AMBER));
	} else {
		lines.push(applyColor("No active mission", THEME.INACTIVE));
	}

	return lines.join("\n");
}
