#!/usr/bin/env bun

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

const child = spawn("bun", [suitePath], {
	stdio: "inherit",
});

child.on("exit", (code) => {
	process.exit(code || 0);
});
