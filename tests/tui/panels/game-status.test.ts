import { describe, test } from "bun:test";
import { renderGameStatusPanel } from "../../../src/tui/panels/game-status";
import type { GameStatusType } from "../../../src/types";

/**
 * Strip blessed color tags to show clean visual output
 */
function stripTags(text: string): string {
	return text.replace(/\{[^}]*\}/g, "");
}

describe("Game Status Panel - Visual Tests", () => {
	test("All activity states with ASCII art", () => {
		const activities: GameStatusType[] = [
			"waiting_for_tick",
			"requesting_action",
			"llm_thinking",
			"traveling",
			"jumping",
			"processing_result",
			"in_combat",
			"docked",
		];

		console.log("\n" + "=".repeat(60));
		console.log("TEST: All Activity States");
		console.log("=".repeat(60) + "\n");

		activities.forEach((activity) => {
			const details =
				activity === "traveling"
					? "Jupiter Station"
					: activity === "jumping"
						? "Alpha Centauri"
						: activity === "docked"
							? "Mars Base"
							: activity === "in_combat"
								? "Pirate Ship"
								: null;

			const output = renderGameStatusPanel(
				{
					activity,
					spinnerFrame: 0,
					details,
				},
				40, // Panel width
			);
			const cleanOutput = stripTags(output);

			console.log(`--- ${activity} ---`);
			console.log(cleanOutput);
			console.log("");
		});

		console.log("=".repeat(60) + "\n");
	});

	test("All activity states have consistent box width", () => {
		const activities: GameStatusType[] = [
			"waiting_for_tick",
			"requesting_action",
			"llm_thinking",
			"traveling",
			"jumping",
			"processing_result",
			"in_combat",
			"docked",
		];

		console.log("\n" + "=".repeat(60));
		console.log("TEST: Box Width Consistency");
		console.log("=".repeat(60) + "\n");

		const boxWidths: number[] = [];

		activities.forEach((activity) => {
			const output = renderGameStatusPanel({ activity, spinnerFrame: 0 }, 40);
			const cleanOutput = stripTags(output);
			const lines = cleanOutput.split("\n");

			// Find the border line (contains ┌ or └)
			const borderLine = lines.find((line) => line.includes("┌"));
			if (borderLine) {
				const trimmed = borderLine.trim();
				const width = trimmed.length;
				boxWidths.push(width);
				console.log(`${activity}: box width = ${width}`);
			}
		});

		console.log(`\nAll widths: ${boxWidths.join(", ")}`);
		const allSame = boxWidths.every((w) => w === boxWidths[0]);
		console.log(
			allSame
				? `✓ All boxes are ${boxWidths[0]} chars wide`
				: "✗ INCONSISTENT WIDTHS",
		);
		console.log("=".repeat(60) + "\n");

		// Assert all boxes are 18 chars wide
		boxWidths.forEach((width, i) => {
			if (width !== 18) {
				throw new Error(
					`Box ${i} (${activities[i]}) is ${width} chars, expected 18`,
				);
			}
		});
	});

	test("ASCII art centering at different widths", () => {
		const activity: GameStatusType = "requesting_action";

		console.log("\n" + "=".repeat(60));
		console.log("TEST: ASCII Art Centering at Different Widths");
		console.log("=".repeat(60) + "\n");

		[30, 40, 50].forEach((width) => {
			const output = renderGameStatusPanel(
				{
					activity,
					spinnerFrame: 2,
				},
				width,
			);
			const cleanOutput = stripTags(output);

			console.log(`--- Width: ${width} ---`);
			console.log(cleanOutput);
			console.log("");
		});

		console.log("=".repeat(60) + "\n");
	});
});
