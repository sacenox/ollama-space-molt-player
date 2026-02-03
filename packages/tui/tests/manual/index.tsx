#!/usr/bin/env bun
/**
 * Main entry point for manual tests
 * Allows selecting which test suite to run
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const suites = {
	layout: "layout-preview.tsx",
	components: "component-previews.tsx",
};

const suite = process.argv[2] || "layout";

if (!suites[suite as keyof typeof suites]) {
	console.error(`Unknown test suite: ${suite}`);
	console.log(`Available suites: ${Object.keys(suites).join(", ")}`);
	process.exit(1);
}

const suitePath = path.join(__dirname, suites[suite as keyof typeof suites]);

// Run the selected suite
const child = spawn("bun", [suitePath], {
	stdio: "inherit",
});

child.on("exit", (code) => {
	process.exit(code || 0);
});
