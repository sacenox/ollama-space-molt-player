import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { isValidAlignment, isValidEmpire, isValidPersonality } from "./utils";

const DEFAULT_COUNT = 5;
const DEFAULT_PREFIX = "swarm";
const DEFAULT_RESTART_DELAY_MS = 10000;
const SWARM_LOG_PATH = "swarm.log";

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		count: { type: "string", short: "c" },
		prefix: { type: "string", short: "p" },
		"restart-delay": { type: "string" },
		empire: { type: "string" },
		alignment: { type: "string" },
		personality: { type: "string" },
	},
	strict: false,
});

type SwarmConfig = {
	count: number;
	prefix: string;
	restartDelayMs: number;
	empire: string | null;
	alignment: string | null;
	personality: string | null;
};

function logSwarm(message: string): void {
	const line = `[${new Date().toISOString()}] ${message}`;
	console.log(line);
	try {
		appendFileSync(SWARM_LOG_PATH, `${line}\n`, "utf8");
	} catch (error) {
		console.error(
			`Failed to write ${SWARM_LOG_PATH}: ${(error as Error).message}`,
		);
	}
}

function parseCount(raw: unknown): number {
	if (raw === undefined) return DEFAULT_COUNT;
	if (typeof raw !== "string" || raw.trim() === "") {
		console.error("Error: --count requires a numeric value");
		process.exit(1);
	}
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		console.error("Error: --count must be a positive number");
		process.exit(1);
	}
	return Math.floor(value);
}

function parseRestartDelay(raw: unknown): number {
	if (raw === undefined) return DEFAULT_RESTART_DELAY_MS;
	if (typeof raw !== "string" || raw.trim() === "") {
		console.error("Error: --restart-delay requires a numeric value in ms");
		process.exit(1);
	}
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		console.error("Error: --restart-delay must be a positive number (ms)");
		process.exit(1);
	}
	return Math.floor(value);
}

function parsePrefix(raw: unknown): string {
	if (raw === undefined) return DEFAULT_PREFIX;
	if (typeof raw !== "string" || raw.trim() === "") {
		console.error("Error: --prefix requires a value");
		process.exit(1);
	}
	const trimmed = raw.trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
		console.error(
			"Error: --prefix must contain only letters, numbers, dashes, and underscores",
		);
		process.exit(1);
	}
	return trimmed;
}

function parseEmpire(raw: unknown): string | null {
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

function parseAlignment(raw: unknown): string | null {
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

function parsePersonality(raw: unknown): string | null {
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

const swarmConfig: SwarmConfig = {
	count: parseCount(values.count),
	prefix: parsePrefix(values.prefix),
	restartDelayMs: parseRestartDelay(values["restart-delay"]),
	empire: parseEmpire(values.empire),
	alignment: parseAlignment(values.alignment),
	personality: parsePersonality(values.personality),
};

const children = new Map<string, ReturnType<typeof spawn>>();
const restartTimers = new Map<string, ReturnType<typeof setTimeout>>();
let stopping = false;

function buildInstanceName(
	index: number,
	count: number,
	prefix: string,
): string {
	const digits = Math.max(2, String(count).length);
	const padded = String(index).padStart(digits, "0");
	return `${prefix}-${padded}`;
}

function buildArgs(instanceName: string): string[] {
	const args = [
		"run",
		"ollama-play",
		"--name",
		instanceName,
		"--non-interactive",
	];
	if (swarmConfig.empire) {
		args.push("--empire", swarmConfig.empire);
	}
	if (swarmConfig.alignment) {
		args.push("--alignment", swarmConfig.alignment);
	}
	if (swarmConfig.personality) {
		args.push("--personality", swarmConfig.personality);
	}
	return args;
}

function spawnBot(instanceName: string): void {
	if (stopping) return;
	const args = buildArgs(instanceName);
	const child = spawn("bun", args, {
		stdio: "ignore",
		env: {
			...process.env,
			OLLAMA_THINKING: "false",
			OLLAMA_MODEL: "ministral-3:8b",
		},
	});

	children.set(instanceName, child);
	logSwarm(`spawned ${instanceName} (pid=${child.pid ?? "unknown"})`);

	child.on("exit", (code, signal) => {
		children.delete(instanceName);
		const status = `code=${code ?? "null"} signal=${signal ?? "null"}`;
		logSwarm(`exited ${instanceName} (${status})`);
		if (stopping) return;
		const timer = setTimeout(() => {
			restartTimers.delete(instanceName);
			logSwarm(`restarting ${instanceName}`);
			spawnBot(instanceName);
		}, swarmConfig.restartDelayMs);
		restartTimers.set(instanceName, timer);
	});

	child.on("error", (error) => {
		logSwarm(`error ${instanceName} (${error.message})`);
	});
}

function shutdown(reason: string): void {
	if (stopping) return;
	stopping = true;
	logSwarm(`shutdown ${reason}`);
	for (const timer of restartTimers.values()) {
		clearTimeout(timer);
	}
	restartTimers.clear();
	for (const [name, child] of children.entries()) {
		try {
			child.kill("SIGTERM");
			logSwarm(`stopping ${name}`);
		} catch (error) {
			logSwarm(`failed to stop ${name} (${(error as Error).message})`);
		}
	}
}

function startSwarm(): void {
	logSwarm(
		`start count=${swarmConfig.count} prefix=${swarmConfig.prefix} restartDelayMs=${swarmConfig.restartDelayMs}`,
	);
	if (swarmConfig.empire) logSwarm(`override empire=${swarmConfig.empire}`);
	if (swarmConfig.alignment)
		logSwarm(`override alignment=${swarmConfig.alignment}`);
	if (swarmConfig.personality)
		logSwarm(`override personality=${swarmConfig.personality}`);

	for (let i = 1; i <= swarmConfig.count; i += 1) {
		const name = buildInstanceName(i, swarmConfig.count, swarmConfig.prefix);
		spawnBot(name);
	}
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
	logSwarm(`uncaughtException ${(error as Error).message}`);
	shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
	logSwarm(`unhandledRejection ${String(reason)}`);
	shutdown("unhandledRejection");
});
process.on("exit", () => shutdown("exit"));

startSwarm();
