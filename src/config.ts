import { parseArgs } from "node:util";

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		name: { type: "string", short: "n" },
		"non-interactive": { type: "boolean" },
		"max-ticks": { type: "string" },
	},
	strict: false,
});

function getInstanceName(): string {
	const name = values.name;
	if (!name || typeof name !== "string" || name.trim() === "") {
		console.error("Error: --name / -n <instance-name> is required");
		console.error("Usage: bun run ollama-play --name <instance-name>");
		process.exit(1);
	}

	const trimmed = name.trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
		console.error(
			"Error: instance name must contain only letters, numbers, dashes, and underscores",
		);
		process.exit(1);
	}

	return trimmed;
}

function parseMaxTicks(raw: unknown): number | null {
	if (raw === undefined) return null;
	if (typeof raw !== "string" || raw.trim() === "") {
		console.error("Error: --max-ticks requires a numeric value");
		process.exit(1);
	}
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		console.error("Error: --max-ticks must be a positive number");
		process.exit(1);
	}
	return Math.floor(value);
}

const instanceName = getInstanceName();
const nonInteractive = values["non-interactive"] === true;
const maxTicks = parseMaxTicks(values["max-ticks"]);

export const config = {
	instanceName,
	nonInteractive,
	maxTicks,
	ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
	ollamaModel: process.env.OLLAMA_MODEL ?? "qwen3:8b",
	ollamaTemperature: (() => {
		const raw = process.env.OLLAMA_TEMPERATURE;
		if (!raw) return 0.5;
		const value = Number(raw);
		return Number.isFinite(value) ? value : 0.5;
	})(),
	ollamaThinking: process.env.OLLAMA_THINKING !== "false",
	spacemoltUrl: process.env.SPACEMOLT_URL ?? "wss://game.spacemolt.com/ws",
	debug: process.env.DEBUG === "true",
	memoryPath: process.env.MEMORY_DB ?? `memory-${instanceName}.sqlite`,
	uiLogPath: `ui-${instanceName}.log`,
	debugLogPath: `debug-${instanceName}.log`,
	tickDelayMs: 11000,
	maxContextActions: 5,
	maxContextEvents: 5,
	ollamaTimeoutMs: 60000,
};
