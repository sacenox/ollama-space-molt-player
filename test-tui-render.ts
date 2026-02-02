#!/usr/bin/env bun

// Test script to render TUI components to file for validation

import { writeFileSync } from "node:fs";
import { renderActionResultPanel } from "./src/tui/panels/action-result";
import { renderGameStatusPanel } from "./src/tui/panels/game-status";
import type { ActionHistoryEntry, GameStatusType } from "./src/types";

/**
 * Strip blessed color tags from text
 */
function stripBlessedTags(text: string): string {
	return text.replace(/\{[^}]*\}/g, "");
}

// Sample test data
const sampleHistory: ActionHistoryEntry[] = [
	{
		tick: 100,
		action: "travel Alpha-7",
		result: `Action: Travel to Alpha-7
Result:
- Traveling to Alpha-7
- ETA: 3 ticks
- Current fuel: 45%`,
		timestamp: Date.now(),
	},
	{
		tick: 99,
		action: "scan sector",
		result: `Action: Scan sector
Result:
- ERROR: Insufficient power for scan
-> Try recharging at nearby station`,
		timestamp: Date.now() - 10000,
	},
	{
		tick: 98,
		action: "buy fuel 100",
		result: `Action: Buy 100 units of fuel
Result:
- Purchase successful
- Total cost: 250 credits
- New balance: 1,750 credits`,
		timestamp: Date.now() - 20000,
	},
];

const sampleGameStatus = {
	activity: "llm_thinking" as GameStatusType,
	details: "Analyzing sector",
	spinnerFrame: 3,
};

// Test different panel widths
const testWidths = [40, 60, 80, 100];

let output = "=".repeat(80) + "\n";
output += "TUI COMPONENT RENDER TEST\n";
output += "=".repeat(80) + "\n\n";

for (const width of testWidths) {
	output += `\n${"=".repeat(width)}\n`;
	output += `Panel Width: ${width}\n`;
	output += `${"=".repeat(width)}\n\n`;

	// Test Action Result Panel
	output += "ACTION RESULT PANEL:\n";
	output += "-".repeat(width) + "\n";
	const resultPanel = renderActionResultPanel(sampleHistory, width);
	output += stripBlessedTags(resultPanel) + "\n";
	output += "-".repeat(width) + "\n\n";

	// Test Game Status Panel
	output += "GAME STATUS PANEL:\n";
	output += "-".repeat(width) + "\n";
	const statusPanel = renderGameStatusPanel(sampleGameStatus, width);
	output += stripBlessedTags(statusPanel) + "\n";
	output += "-".repeat(width) + "\n\n";
}

// Test all activity states for Game Status
output += "\n" + "=".repeat(80) + "\n";
output += "ALL ACTIVITY STATES (width=60)\n";
output += "=".repeat(80) + "\n\n";

const activityStates: GameStatusType[] = [
	"waiting_for_tick",
	"requesting_action",
	"llm_thinking",
	"traveling",
	"jumping",
	"processing_result",
	"in_combat",
	"docked",
];

for (const activity of activityStates) {
	const statusData = {
		activity,
		details:
			activity === "traveling" || activity === "jumping"
				? "Sector Alpha-7"
				: activity === "docked"
					? "Station Omega"
					: null,
		spinnerFrame: 0,
	};

	output += `\n${activity.toUpperCase()}:\n`;
	output += "-".repeat(60) + "\n";
	const panel = renderGameStatusPanel(statusData, 60);
	output += stripBlessedTags(panel) + "\n";
	output += "-".repeat(60) + "\n";
}

// Write to file
const outputPath =
	"/home/xonecas/src/ollama-spacemolt-player/tui-render-test.txt";
writeFileSync(outputPath, output, "utf-8");

console.log(`✓ TUI render test output written to: ${outputPath}`);
console.log(`✓ Tested ${testWidths.length} panel widths`);
console.log(`✓ Tested ${activityStates.length} activity states`);
