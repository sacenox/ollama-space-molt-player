import { parseArgs } from "node:util";

import type { EmpireID } from "../client/src/types";
import type { AlignmentType, PersonalityType, SpeechStyleType } from "./types";
import {
	isValidAlignment,
	isValidEmpire,
	isValidPersonality,
	isValidSpeechStyle,
} from "./utils";

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		name: { type: "string", short: "n" },
		"non-interactive": { type: "boolean" },
		"max-ticks": { type: "string" },
		empire: { type: "string", short: "e" },
		alignment: { type: "string", short: "a" },
		personality: { type: "string", short: "p" },
		"speech-style": { type: "string", short: "s" },
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

function parseEmpire(raw: unknown): EmpireID | null {
	if (raw === undefined) return null;
	if (typeof raw !== "string" || raw.trim() === "") {
		console.error("Error: --empire requires a value");
		process.exit(1);
	}
	const value = raw.trim().toLowerCase();
	if (!isValidEmpire(value)) {
		console.error(
			"Error: --empire must be one of: solarian, voidborn, crimson, nebula, outerrim",
		);
		process.exit(1);
	}
	return value;
}

function parseAlignment(raw: unknown): AlignmentType | null {
	if (raw === undefined) return null;
	if (typeof raw !== "string" || raw.trim() === "") {
		console.error("Error: --alignment requires a value");
		process.exit(1);
	}
	const value = raw.trim().toLowerCase();
	if (!isValidAlignment(value)) {
		console.error(
			"Error: --alignment must be one of: lawful, good, neutral, chaotic, evil",
		);
		process.exit(1);
	}
	return value;
}

function parsePersonality(raw: unknown): PersonalityType | null {
	if (raw === undefined) return null;
	if (typeof raw !== "string" || raw.trim() === "") {
		console.error("Error: --personality requires a value");
		process.exit(1);
	}
	const value = raw.trim().toLowerCase();
	if (!isValidPersonality(value)) {
		console.error(
			"Error: --personality must be one of: cartographer, merchant, warrior, diplomat, pragmatist",
		);
		process.exit(1);
	}
	return value;
}

function parseSpeechStyle(raw: unknown): SpeechStyleType | null {
	if (raw === undefined) return null;
	if (typeof raw !== "string" || raw.trim() === "") {
		console.error("Error: --speech-style requires a value");
		process.exit(1);
	}
	const value = raw.trim().toLowerCase();
	if (!isValidSpeechStyle(value)) {
		console.error(
			"Error: --speech-style must be one of: mythic, punny, gritty, scholarly",
		);
		process.exit(1);
	}
	return value;
}

const instanceName = getInstanceName();
const nonInteractive = values["non-interactive"] === true;
const maxTicks = parseMaxTicks(values["max-ticks"]);
const empire = parseEmpire(values.empire);
const alignment = parseAlignment(values.alignment);
const personality = parsePersonality(values.personality);
const speechStyle = parseSpeechStyle(values["speech-style"]);

export const config = {
	instanceName,
	nonInteractive,
	maxTicks,
	empire,
	alignment,
	personality,
	speechStyle,
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
	maxContextActions: 20,
	maxContextEvents: 40,
	ollamaTimeoutMs: 60000,
};
