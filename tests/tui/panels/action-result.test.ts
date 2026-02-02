import { describe, expect, test } from "bun:test";
import { renderActionResultPanel } from "../../../src/tui/panels/action-result";
import type { ActionHistoryEntry } from "../../../src/types";

/**
 * Strip blessed color tags to show clean visual output
 */
function stripTags(text: string): string {
	return text.replace(/\{[^}]*\}/g, "");
}

describe("Action Result Panel - Visual Tests", () => {
	test("Single successful action", () => {
		const mockHistory: ActionHistoryEntry[] = [
			{
				action: "mine",
				result:
					"Action: (current) mine target_poi=jupiter_002\nResult:\n- Mined 5 units of ore_iron\n- Credits earned: 150",
				tick: 100,
				timestamp: Date.now(),
			},
		];

		const output = renderActionResultPanel(mockHistory, 60);
		const cleanOutput = stripTags(output);
		console.log("\n" + "=".repeat(60));
		console.log("TEST: Single Successful Action");
		console.log("=".repeat(60));
		console.log(cleanOutput);
		console.log("=".repeat(60) + "\n");

		// Verify borders present
		expect(output).toContain("╔");
		expect(output).toContain("╗");
		expect(output).toContain("║");
		expect(output).toContain("╚");
		expect(output).toContain("╝");
		expect(output).toContain("TRADE");
	});

	test("Action with error", () => {
		const mockHistory: ActionHistoryEntry[] = [
			{
				action: "sell",
				result:
					"Action: (current) sell item_id=ore_iron quantity=50\nResult:\n- ERROR [insufficient_items]: Not enough items in cargo\n  -> SOLUTION: Check cargo before selling",
				tick: 10743,
				timestamp: Date.now(),
			},
		];

		const output = renderActionResultPanel(mockHistory, 60);
		const cleanOutput = stripTags(output);
		console.log("\n" + "=".repeat(60));
		console.log("TEST: Action With Error");
		console.log("=".repeat(60));
		console.log(cleanOutput);
		console.log("=".repeat(60) + "\n");

		expect(output).toContain("insufficient_items"); // Error code is present
		// Should NOT contain divider
		expect(output).not.toContain("├─────");
	});

	test("Multiple actions in history", () => {
		const mockHistory: ActionHistoryEntry[] = [
			{
				action: "status",
				result:
					"Action: (current) status\nResult:\n- Status information updated",
				tick: 103,
				timestamp: Date.now(),
			},
			{
				action: "mine",
				result:
					"Action: (1 tick ago) mine target_poi=asteroid_belt_01\nResult:\n- Mined 3 units",
				tick: 102,
				timestamp: Date.now() - 11000,
			},
			{
				action: "travel",
				result:
					"Action: (2 ticks ago) travel target_poi=asteroid_belt_01\nResult:\n- Traveling to asteroid_belt_01",
				tick: 101,
				timestamp: Date.now() - 22000,
			},
		];

		const output = renderActionResultPanel(mockHistory, 70);
		const cleanOutput = stripTags(output);
		console.log("\n" + "=".repeat(70));
		console.log("TEST: Multiple Actions (History)");
		console.log("=".repeat(70));
		console.log(cleanOutput);
		console.log("=".repeat(70) + "\n");

		expect(output).toContain("[LATEST]");
		// Should NOT contain box-drawing separator
		expect(output).not.toContain("├─────");
	});

	test("Border alignment at various widths", () => {
		const mockHistory: ActionHistoryEntry[] = [
			{
				action: "scan",
				result:
					"Action: (current) scan target_id=pirate_fighter_42\nResult:\n- Ship scanned\n- Hull: 80/100\n- Shield: 50/50",
				tick: 200,
				timestamp: Date.now(),
			},
		];

		[40, 60, 80].forEach((width) => {
			const output = renderActionResultPanel(mockHistory, width);
			const cleanOutput = stripTags(output);
			console.log(`\n${"=".repeat(width)}`);
			console.log(`TEST: Border Alignment (width=${width})`);
			console.log("=".repeat(width));
			console.log(cleanOutput);
			console.log("=".repeat(width) + "\n");

			// Should have borders
			expect(output).toContain("╔");
			expect(output).toContain("║");
			expect(output).toContain("╝");
		});
	});
});
