import { parseArgs } from "util";

function getInstanceName(): string {
	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			name: { type: "string", short: "n" },
		},
		strict: false,
	});

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

const instanceName = getInstanceName();

export const config = {
	instanceName,
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
	credentialsFile: `.spacemolt-bot-${instanceName}.json`,
	tickDelayMs: 11000,
	maxContextActions: 5,
	maxContextEvents: 5,
	ollamaTimeoutMs: 60000,
};
