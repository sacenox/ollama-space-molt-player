import { SpaceMoltClient } from "../client/src/client";
import type {
	ChatMessage,
	ErrorPayload,
	LoggedInPayload,
	RegisteredPayload,
	ScanResultPayload,
	StateUpdatePayload,
	WelcomePayload,
} from "../client/src/types";
import { dispatchAction, validateAction } from "./actions";
import { config } from "./config";
import { GameState } from "./game-state";
import { MemoryStore } from "./memory";
import { OllamaAgent, OllamaTimeoutError } from "./ollama";
import { FileLoggerOutput } from "./output/file-logger-output";
import { TuiOutput } from "./output/tui-output";
import type { OutputInterface } from "./output-interface";
import { buildActionPrompt, type WorldSnapshot } from "./prompt";
import { runRegistrationFlow } from "./registration";
import {
	formatAiAction,
	formatAiGoal,
	formatAiThinking,
	formatChatMessage,
	formatError,
	formatLoggedIn,
	formatMotd,
	formatOk,
	formatScanResult,
	formatSystemMessage,
	formatWelcome,
	type OkContext,
} from "./tui/formatters";
import type { Credentials, PersonalityType } from "./types";
import { detectRepetition, isNearbyTarget, sleep } from "./utils";

const memory = new MemoryStore(config.memoryPath);
const ollama = new OllamaAgent(
	config.ollamaUrl,
	config.ollamaModel,
	config.ollamaTimeoutMs,
	config.ollamaTemperature,
	config.ollamaThinking,
);
const output: OutputInterface = config.nonInteractive
	? new FileLoggerOutput({
			uiLogPath: config.uiLogPath,
			debugLogPath: config.debugLogPath,
		})
	: new TuiOutput(config.debug);

const client = new SpaceMoltClient({
	url: config.spacemoltUrl,
	debug: false,
	reconnect: true,
});

const gameState = new GameState();
let actionLoopRunning = false;
const REPETITION_THRESHOLD = 3;
let maxTicksStart: number | null = null;
let fallbackTickCount = 0;

async function loadCredentials(): Promise<Credentials | null> {
	try {
		return memory.getCredentials();
	} catch (error) {
		output.log(
			formatSystemMessage(
				`FATAL: Failed to load credentials: ${(error as Error).message}`,
			),
		);
		shutdown();
		return null;
	}
}

async function saveCredentials(
	username: string,
	token: string,
	personality: PersonalityType,
): Promise<void> {
	memory.saveCredentials(username, token, personality);
}

function updateOutput(): void {
	const state = client.state;
	output.update({
		player: gameState.cachedPlayer,
		ship: gameState.cachedShip,
		system: gameState.worldSnapshot.system ?? state.system ?? null,
		poi: gameState.worldSnapshot.poi ?? state.poi ?? null,
		base: gameState.worldSnapshot.base ?? state.base ?? null,
		pois: gameState.worldSnapshot.pois ?? [],
		nearby: state.nearby ?? [],
		personality: gameState.credentials?.personality,
		tick: state.currentTick,
		traveling: gameState.travelInProgress,
		travelTarget: gameState.lastTravelTarget,
		jumping: gameState.jumpInProgress,
		jumpTarget: gameState.lastJumpTarget,
		goal: gameState.currentGoal,
		inCombat: gameState.inCombat,
	});
}

function shouldStopForMaxTicks(allowFallbackCount: boolean): boolean {
	if (config.maxTicks === null) return false;
	const currentTick = client.state.currentTick;
	if (typeof currentTick === "number" && maxTicksStart !== null) {
		return currentTick - maxTicksStart >= config.maxTicks;
	}
	if (typeof currentTick === "number" && maxTicksStart === null) {
		maxTicksStart = currentTick;
		return false;
	}
	if (!allowFallbackCount) return false;
	fallbackTickCount += 1;
	return fallbackTickCount >= config.maxTicks;
}

function saveSnapshot(): void {
	memory.saveSnapshot({
		tick: client.state.currentTick,
		player: client.state.player,
		ship: client.state.ship,
		system: client.state.system,
		poi: client.state.poi,
		base: client.state.base,
		nearby: client.state.nearby,
	});
}

function refreshSnapshotForLocation(player: {
	current_system?: string;
	current_poi?: string;
	docked_at_base?: string | boolean | null;
}): void {
	const systemId = player.current_system ?? null;
	const poiId = player.current_poi ?? null;
	const docked = Boolean(player.docked_at_base);
	const systemChanged = systemId && systemId !== gameState.lastSystemId;
	const poiChanged = poiId && poiId !== gameState.lastPoiId;

	if (systemChanged) {
		gameState.worldSnapshot.system = null;
		gameState.worldSnapshot.pois = [];
		gameState.worldSnapshot.poi = null;
		gameState.worldSnapshot.base = null;
		client.state.system = null;
		client.state.poi = null;
		client.state.base = null;
		client.getSystem();
		client.getPOI();
		if (docked) {
			client.getBase();
		}
	} else if (poiChanged) {
		gameState.worldSnapshot.poi = null;
		gameState.worldSnapshot.base = null;
		client.state.poi = null;
		client.state.base = null;
		client.getPOI();
		if (docked) {
			client.getBase();
		}
	}

	if (!docked && gameState.lastDocked) {
		gameState.worldSnapshot.base = null;
		client.state.base = null;
	}

	if (docked && !gameState.lastDocked && !systemChanged && !poiChanged) {
		client.getBase();
	}

	if (systemId) gameState.lastSystemId = systemId;
	if (poiId) gameState.lastPoiId = poiId;
	gameState.lastDocked = docked;
}

async function startActionLoop(): Promise<void> {
	if (actionLoopRunning) return;
	actionLoopRunning = true;

	while (client.state.authenticated) {
		const inTransit = gameState.travelInProgress || gameState.jumpInProgress;
		if (shouldStopForMaxTicks(!inTransit)) {
			output.log(
				formatSystemMessage(
					`Max ticks reached (${config.maxTicks}). Shutting down.`,
				),
			);
			shutdown();
			break;
		}
		try {
			if (inTransit) {
				await sleep(config.tickDelayMs);
				continue;
			}
			const recentHistory = memory.getRecentHistory(
				config.maxContextActions,
				config.maxContextEvents,
			);
			const recentActions = memory.getRecentActions(REPETITION_THRESHOLD);
			const repetitionWarning = detectRepetition(
				recentActions,
				REPETITION_THRESHOLD,
			);
			const prompt = buildActionPrompt({
				state: client.state,
				worldSnapshot: gameState.worldSnapshot,
				recentHistory,
				currentGoal: gameState.currentGoal,
				personality: gameState.credentials?.personality,
				repetitionWarning,
			});

			output.setPrompt(prompt);
			output.logDebug("LLM_PROMPT", prompt);

			const promptExcerpt = prompt.slice(0, 1000);
			const result = await ollama.generateJson(prompt);
			output.logDebug("LLM_RESPONSE_RAW", result.raw);
			if (result.thinking) {
				output.log(formatAiThinking(result.thinking));
				output.logDebug("LLM_THINKING", result.thinking);
			}
			const validation = validateAction(result.json);
			if (!validation.ok || !validation.action) {
				const message = `Invalid action from LLM: ${validation.error ?? "unknown"}`;
				output.log(formatSystemMessage(message));
				memory.appendEvent("llm_invalid_action", {
					error: validation.error,
					raw: result.raw,
				});
				await sleep(config.tickDelayMs);
				continue;
			}

			if (
				(validation.action.action === "scan" ||
					validation.action.action === "attack") &&
				!isNearbyTarget(client.state.nearby, validation.action.args?.target_id)
			) {
				const target = String(validation.action.args?.target_id ?? "").trim();
				const message = target
					? `Invalid action from LLM: Unknown nearby target: ${target}`
					: "Invalid action from LLM: Missing target_id";
				output.log(formatSystemMessage(message));
				memory.appendEvent("llm_invalid_action", {
					error: message,
					raw: result.raw,
				});
				await sleep(config.tickDelayMs);
				continue;
			}

			const actionName = validation.action.action;
			const goal = validation.action.goal ?? null;
			if (client.state.player?.username && goal) {
				gameState.currentGoal = goal;
				memory.setGoal(client.state.player.username, goal);
				output.log(formatAiGoal(goal));
				updateOutput();
			}
			memory.appendAction(
				actionName,
				validation.action.args ?? {},
				promptExcerpt,
				result.raw,
			);
			if (actionName === "travel") {
				gameState.lastTravelTarget =
					String(validation.action.args?.target_poi ?? "").trim() || null;
			}
			if (actionName === "jump") {
				gameState.lastJumpTarget =
					String(validation.action.args?.target_system ?? "").trim() || null;
			}
			dispatchAction(client, validation.action);
			output.log(formatAiAction(actionName, validation.action.args));
			memory.appendEvent("action_sent", { action: validation.action });

			if (actionName === "travel") {
				client.getSystem();
				client.getPOI();
			}
		} catch (error) {
			const message = (error as Error).message;
			if (error instanceof OllamaTimeoutError) {
				output.log(
					formatSystemMessage(`LLM timeout: ${message}. Retrying next tick.`),
				);
				memory.appendEvent("llm_timeout", { message });
			} else {
				output.log(formatSystemMessage(`Loop error: ${message}`));
				memory.appendEvent("loop_error", { message });
			}
		}

		await sleep(config.tickDelayMs);
	}

	actionLoopRunning = false;
}

function shutdown(): void {
	try {
		client.disconnect();
	} catch {
		// ignore
	}
	output.destroy();
	process.exit(0);
}

output.onExit(shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Log ALL raw messages for debugging server communication
client.on("raw_message", (data: { type: string; payload: unknown }) => {
	memory.appendEvent(`raw_${data.type}`, data.payload);
});

client.on<WelcomePayload>("welcome", async (data) => {
	output.log(formatWelcome(data));
	if (data.motd) output.log(formatMotd(data.motd));
	memory.appendEvent("welcome", data);

	if (gameState.credentials) {
		output.log(
			formatSystemMessage(`Auto-login as ${gameState.credentials.username}`),
		);
		client.login(gameState.credentials.username, gameState.credentials.token);
	} else {
		gameState.pendingRegistration = await runRegistrationFlow(
			output,
			ollama,
			client,
			gameState.failedRegistrationNames,
		);
	}
});

client.on<RegisteredPayload>("registered", (data) => {
	memory.appendEvent("registered", data);

	if (!data.token) {
		output.log(
			formatSystemMessage("FATAL: Server sent registered event without token"),
		);
		output.logDebug("REGISTERED_NO_TOKEN", JSON.stringify(data, null, 2));
		shutdown();
		return;
	}

	output.log(formatSystemMessage("Registration successful - token received"));
	output.logDebug("REGISTERED_PAYLOAD", JSON.stringify(data, null, 2));

	if (gameState.pendingRegistration) {
		gameState.pendingRegistration.token = data.token;
	}
});

client.on<LoggedInPayload>("logged_in", async (data) => {
	output.log(formatLoggedIn(data));
	memory.appendEvent("logged_in", data);
	output.logDebug("LOGGED_IN_PAYLOAD", JSON.stringify(data, null, 2));

	// CASE 1: New registration - save credentials
	if (gameState.pendingRegistration) {
		const token = gameState.pendingRegistration.token;

		if (!token) {
			output.log(
				formatSystemMessage(
					"FATAL: Logged in but no token was captured from registered event",
				),
			);
			shutdown();
			return;
		}

		try {
			await saveCredentials(
				gameState.pendingRegistration.username,
				token,
				gameState.pendingRegistration.personality,
			);

			gameState.credentials = {
				username: gameState.pendingRegistration.username,
				token: token,
				personality: gameState.pendingRegistration.personality,
			};

			output.log(
				formatSystemMessage(
					`Credentials saved for ${gameState.pendingRegistration.username}`,
				),
			);
			gameState.pendingRegistration = null;
		} catch (err) {
			output.log(
				formatSystemMessage(
					`FATAL: Failed to save credentials: ${(err as Error).message}`,
				),
			);
			shutdown();
			return;
		}
	}

	// CASE 2: Initialize session (both new registration and existing login)
	initializeSessionFromLoggedIn(data);
});

client.on<ErrorPayload>("error", (data) => {
	output.log(formatError(data));
	memory.appendEvent("error", data);
	if (data.code === "invalid_credentials") {
		output.log(
			formatSystemMessage(
				"FATAL: Invalid credentials. The saved token is invalid or expired.",
			),
		);
		output.log(
			formatSystemMessage(
				`Delete ${config.memoryPath} and run again to create a new account.`,
			),
		);
		shutdown();
		return;
	}
	if (data.code === "username_taken" && gameState.pendingRegistration) {
		if (gameState.pendingRegistration.username) {
			gameState.failedRegistrationNames.push(
				gameState.pendingRegistration.username,
			);
		}
		if (gameState.registrationRetries < gameState.MAX_REGISTRATION_RETRIES) {
			gameState.registrationRetries += 1;
			output.log(
				formatSystemMessage(
					"Username taken. Requesting a new registration name...",
				),
			);
			gameState.pendingRegistration = null;
			runRegistrationFlow(
				output,
				ollama,
				client,
				gameState.failedRegistrationNames,
			).then((choice) => {
				gameState.pendingRegistration = choice;
			});
		} else {
			output.log(
				formatSystemMessage(
					"Username taken repeatedly. Falling back to random name.",
				),
			);
			const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
			gameState.pendingRegistration = {
				username: fallback,
				empire: "solarian",
				personality: "pragmatist",
			};
			client.register(fallback, "solarian");
		}
	}
});

client.on<StateUpdatePayload>("state_update", async (data) => {
	memory.appendEvent("state_update", data);

	// Ignore state updates before authentication
	if (!client.state.authenticated) {
		return;
	}

	// Update cached player and ship data
	if (data.player) {
		gameState.cachedPlayer = data.player;
	}
	if (data.ship) {
		gameState.cachedShip = data.ship;
	}

	if (data.player) {
		refreshSnapshotForLocation(data.player);

		// Log state update if significant (only when credits change)
		const creditsChanged =
			gameState.lastCredits !== null &&
			data.player.credits !== gameState.lastCredits;
		if (creditsChanged) {
			const diff = data.player.credits - (gameState.lastCredits ?? 0);
			const sign = diff > 0 ? "+" : "";
			output.log(
				formatSystemMessage(`Credits: ${data.player.credits} (${sign}${diff})`),
			);
			gameState.lastCredits = data.player.credits;
		}
	}

	// Track combat state changes
	const wasInCombat = gameState.inCombat;
	gameState.inCombat = data.in_combat ?? false;

	// Log combat state changes
	if (gameState.inCombat && !wasInCombat) {
		output.log(formatSystemMessage("COMBAT STARTED"));
	} else if (!gameState.inCombat && wasInCombat) {
		output.log(formatSystemMessage("Combat ended"));
	}

	updateOutput();
	saveSnapshot();
});

client.on<ChatMessage>("chat_message", (data) => {
	output.log(formatChatMessage(data));
	memory.appendEvent("chat_message", data);
});

client.on<ScanResultPayload>("scan_result", (data) => {
	output.log(formatScanResult(data));
	memory.appendEvent("scan_result", data);
});

client.on("ok", (data: Record<string, unknown>) => {
	const okContext: OkContext = {
		jumpTarget: gameState.lastJumpTarget,
		travelTarget: gameState.lastTravelTarget,
	};
	output.log(formatOk(data, okContext));
	memory.appendEvent("ok", data);
	updateWorldSnapshotFromOk(data);

	const action = typeof data.action === "string" ? data.action : null;
	if (action === "travel") {
		gameState.travelInProgress = true;
	}
	if (action === "jump") {
		gameState.jumpInProgress = true;
	}
	if (action === "arrived") {
		gameState.travelInProgress = false;
		gameState.lastTravelTarget = null;
		client.getSystem();
		client.getPOI();
	}
	if (action === "jumped") {
		gameState.jumpInProgress = false;
		gameState.lastJumpTarget = null;
		client.getSystem();
		client.getPOI();
	}
	updateOutput();
});

client.on("version_info", (data: Record<string, unknown>) => {
	const version = String(data.version ?? "unknown");
	output.log(formatSystemMessage(`Version: ${version}`));
	memory.appendEvent("version_info", data);
});

gameState.credentials = await loadCredentials();

console.log(`Instance: ${config.instanceName}`);
console.log(`DB: ${config.memoryPath}`);
output.log(formatSystemMessage(`Instance: ${config.instanceName}`));
output.log(formatSystemMessage(`DB: ${config.memoryPath}`));

await client.connect();
updateOutput();

function updateWorldSnapshotFromOk(data: Record<string, unknown>): void {
	if (data.system && typeof data.system === "object") {
		gameState.worldSnapshot.system = data.system as WorldSnapshot["system"];
	}
	if (Array.isArray(data.pois)) {
		gameState.worldSnapshot.pois = data.pois as WorldSnapshot["pois"];
	}
	if (data.poi && typeof data.poi === "object") {
		gameState.worldSnapshot.poi = data.poi as WorldSnapshot["poi"];
	}
	if (data.base && typeof data.base === "object") {
		gameState.worldSnapshot.base = data.base as WorldSnapshot["base"];
	}
}

function initializeSessionFromLoggedIn(data: LoggedInPayload): void {
	client.state.authenticated = true;
	gameState.cachedPlayer = data.player;
	gameState.cachedShip = data.ship;
	gameState.lastCredits = data.player.credits;

	gameState.worldSnapshot.system = data.system;
	gameState.worldSnapshot.poi = data.poi;

	if (data.player.current_system) {
		gameState.lastSystemId = data.player.current_system;
	}
	if (data.player.current_poi) {
		gameState.lastPoiId = data.player.current_poi;
	}

	gameState.lastDocked = Boolean(data.player.docked_at_base);
	gameState.currentGoal = memory.getLatestGoal(data.player.username);

	// Fetch base info if docked
	if (data.player.docked_at_base) {
		client.getBase();
	}

	updateOutput();
	saveSnapshot();
	startActionLoop();
}
