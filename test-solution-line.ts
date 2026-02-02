// Test to understand the solution line rendering

function stripBlessedTags(text: string): string {
	return text.replace(/\{[^}]*\}/g, "");
}

function getVisualWidth(text: string): number {
	return stripBlessedTags(text).length;
}

function applyColor(text: string, color: string): string {
	return `{${color}-fg}${text}{/${color}-fg}`;
}

// Simulate what happens with solution line
const guideText = "SOLUTION: Use action \"dock\" with args {} to dock at the current POI's base";
const PALETTE_MOSS = "green";

// What the code does:
const content = `     ${applyColor(`→ ${guideText}`, PALETTE_MOSS)}`;

console.log("Guide text length:", guideText.length);
console.log("Content string:", content);
console.log("Visual width:", getVisualWidth(content));
console.log("Expected: 5 spaces + 2 (→ ) + ", guideText.length, "=", 5 + 2 + guideText.length);
