#!/usr/bin/env bun
// Test to debug border alignment issue

import { renderActionResultPanel } from "./src/tui/panels/action-result";
import type { ActionHistoryEntry } from "./src/types";

const sampleHistory: ActionHistoryEntry[] = [
	{
		tick: 100,
		action: "mine",
		result: `Action: Mine
Result:
- Mined 4x ore_iron`,
		timestamp: Date.now(),
	},
];

const panelWidth = 60;
const output = renderActionResultPanel(sampleHistory, panelWidth);
const lines = output.split("\n");

console.log(`Panel width: ${panelWidth}`);
console.log(`Expected inner width: ${panelWidth - 2} (minus blessed borders)`);
console.log("\nLine analysis:");

for (let i = 0; i < lines.length; i++) {
	const line = lines[i];
	const stripped = line.replace(/\{[^}]*\}/g, ""); // Strip color tags
	const visualLen = [...stripped].length;
	console.log(`Line ${i}: visual=${visualLen} - "${stripped}"`);
}
