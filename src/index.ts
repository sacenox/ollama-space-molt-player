import { SpaceMoltClient } from "../client/src/client";
import type {
	ChatMessage,
	ErrorPayload,
	ScanResultPayload,
	StateUpdatePayload,
	WelcomePayload,
} from "../client/src/types";
import { dispatchAction, validateAction } from "./actions";
import { config } from "./config";
import { GameState } from "./game-state";
import { MemoryStore } from "./memory";
import { OllamaAgent, OllamaTimeoutError } from "./ollama";
import { buildActionPrompt, type WorldSnapshot } from "./prompt";
import { runRegistrationFlow } from "./registration";
import {
	formatAiAction,
	formatAiGoal,
	formatAiThinking,
	formatChatMessage,
	formatError,
	formatMotd,
	formatOk,
	formatScanResult,
	formatSystemMessage,
	formatWelcome,
	type OkContext,
} from "./tui/formatters";
import { Tui } from "./tui/index";
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
const tui = new Tui(config.debug);

const client = new SpaceMoltClient({
	url: config.spacemoltUrl,
	debug: false,
	reconnect: true,
});

const gameState = new GameState();
let actionLoopRunning = false;
const REPETITION_THRESHOLD = 3;

async function loadCredentials(): Promise<Credentials | null> {
	try {
		const file = Bun.file(config.credentialsFile);
		if (await file.exists()) {
			return (await file.json()) as Credentials;
		}
	} catch {
		return null;
	}
	return null;
}

async function saveCredentials(
	username: string,
	token: string,
	personality: PersonalityType,
): Promise<void> {
	const data: Credentials = { username, token, personality };
	await Bun.write(config.credentialsFile, JSON.stringify(data, null, 2));
}

function updateTui(): void {
	const state = client.state;
	tui.update({
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
		try {
			if (gameState.travelInProgress || gameState.jumpInProgress) {
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

			tui.setPrompt(prompt);

			const promptExcerpt = prompt.slice(0, 1000);
			const result = await ollama.generateJson(prompt);
			if (result.thinking) {
				tui.log(formatAiThinking(result.thinking));
			}
			const validation = validateAction(result.json);
			if (!validation.ok || !validation.action) {
				const message = `Invalid action from LLM: ${validation.error ?? "unknown"}`;
				tui.log(formatSystemMessage(message));
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
				tui.log(formatSystemMessage(message));
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
				tui.log(formatAiGoal(goal));
				updateTui();
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
			tui.log(formatAiAction(actionName, validation.action.args));
			memory.appendEvent("action_sent", { action: validation.action });

			if (actionName === "travel") {
				client.getSystem();
				client.getPOI();
			}
		} catch (error) {
			const message = (error as Error).message;
			if (error instanceof OllamaTimeoutError) {
				tui.log(
					formatSystemMessage(`LLM timeout: ${message}. Retrying next tick.`),
				);
				memory.appendEvent("llm_timeout", { message });
			} else {
				tui.log(formatSystemMessage(`Loop error: ${message}`));
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
	tui.destroy();
	process.exit(0);
}

tui.onExit(shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Log ALL raw messages for debugging server communication
client.on("raw_message", (data: { type: string; payload: unknown }) => {
	memory.appendEvent(`raw_${data.type}`, data.payload);
});

client.on<WelcomePayload>("welcome", async (data) => {
	tui.log(formatWelcome(data));
	if (data.motd) tui.log(formatMotd(data.motd));
	memory.appendEvent("welcome", data);

	if (gameState.credentials) {
		tui.log(
			formatSystemMessage(`Auto-login as ${gameState.credentials.username}`),
		);
		client.login(gameState.credentials.username, gameState.credentials.token);
	} else {
		gameState.pendingRegistration = await runRegistrationFlow(
			tui,
			ollama,
			client,
			gameState.failedRegistrationNames,
		);
	}
});

client.on<ErrorPayload>("error", (data) => {
	tui.log(formatError(data));
	memory.appendEvent("error", data);
	if (data.code === "username_taken" && gameState.pendingRegistration) {
		if (gameState.pendingRegistration.username) {
			gameState.failedRegistrationNames.push(
				gameState.pendingRegistration.username,
			);
		}
		if (gameState.registrationRetries < gameState.MAX_REGISTRATION_RETRIES) {
			gameState.registrationRetries += 1;
			tui.log(
				formatSystemMessage(
					"Username taken. Requesting a new registration name...",
				),
			);
			gameState.pendingRegistration = null;
			runRegistrationFlow(
				tui,
				ollama,
				client,
				gameState.failedRegistrationNames,
			).then((choice) => {
				gameState.pendingRegistration = choice;
			});
		} else {
			tui.log(
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

	// Handle new registration: server v0.3.0+ doesn't send registered/logged_in events
	// It only sends state_update with player data after registration
	if (
		gameState.pendingRegistration &&
		data.player &&
		data.player.username === gameState.pendingRegistration.username
	) {
		// Use player.id as token (server v0.3.0+ behavior)
		const token = gameState.pendingRegistration.token ?? data.player.id;
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
			tui.log(
				formatSystemMessage(
					`Credentials saved for ${gameState.pendingRegistration.username}`,
				),
			);
			gameState.pendingRegistration = null;

			// Start action loop since logged_in won't fire on v0.3.0+
			if (!client.state.authenticated) {
				initializeSessionFromStateUpdate(data);
			}
		} catch (err) {
			tui.log(
				formatSystemMessage(
					`Failed to save credentials: ${(err as Error).message}`,
				),
			);
		}
	} else if (
		!actionLoopRunning &&
		!client.state.authenticated &&
		gameState.credentials &&
		data.player &&
		data.player.username === gameState.credentials.username
	) {
		// Recovery: we have credentials, and received a state update for our user, but aren't flagged as authenticated/running.
		// This might happen if we reconnected and missed a welcome/login event or similar, or just standard 0.3.0+ flow
		initializeSessionFromStateUpdate(
			data,
			`Recovered session for ${data.player.username}`,
		);
	}

	// Update cached player and ship data (only if provided)
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
			tui.log(
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
		tui.log(formatSystemMessage("COMBAT STARTED"));
	} else if (!gameState.inCombat && wasInCombat) {
		tui.log(formatSystemMessage("Combat ended"));
	}

	updateTui();
	saveSnapshot();
});

client.on<ChatMessage>("chat_message", (data) => {
	tui.log(formatChatMessage(data));
	memory.appendEvent("chat_message", data);
});

client.on<ScanResultPayload>("scan_result", (data) => {
	tui.log(formatScanResult(data));
	memory.appendEvent("scan_result", data);
});

client.on("ok", (data: Record<string, unknown>) => {
	const okContext: OkContext = {
		jumpTarget: gameState.lastJumpTarget,
		travelTarget: gameState.lastTravelTarget,
	};
	tui.log(formatOk(data, okContext));
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
	updateTui();
});

client.on("version_info", (data: Record<string, unknown>) => {
	const version = String(data.version ?? "unknown");
	tui.log(formatSystemMessage(`Version: ${version}`));
	memory.appendEvent("version_info", data);
});

gameState.credentials = await loadCredentials();

console.log(`Instance: ${config.instanceName}`);
console.log(`Credentials: ${config.credentialsFile}`);
console.log(`Memory DB: ${config.memoryPath}`);

// Force re-registration if personality is missing
if (gameState.credentials && !gameState.credentials.personality) {
	tui.log(
		formatSystemMessage(
			"Credentials missing personality field - forcing re-registration",
		),
	);
	try {
		await Bun.write(config.credentialsFile, "");
		const file = Bun.file(config.credentialsFile);
		if (await file.exists()) {
			await file.remove?.();
		}
	} catch (error) {
		tui.log(
			formatSystemMessage(
				`Failed to delete credentials: ${(error as Error).message}`,
			),
		);
	}
	gameState.credentials = null;
}

await client.connect();
updateTui();

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

function initializeSessionFromStateUpdate(
	data: StateUpdatePayload,
	message?: string,
): void {
	if (!data.player) return;

	client.state.authenticated = true;
	gameState.cachedPlayer = data.player;
	gameState.cachedShip = data.ship;
	gameState.lastCredits = data.player.credits;

	gameState.worldSnapshot.system = data.system;
	gameState.worldSnapshot.poi = data.poi;
	if (data.player.current_system)
		gameState.lastSystemId = data.player.current_system;
	if (data.player.current_poi) gameState.lastPoiId = data.player.current_poi;
	gameState.lastDocked = Boolean(data.player.docked_at_base);
	gameState.currentGoal = memory.getLatestGoal(data.player.username);

	// Refresh world data
	client.getSystem();
	client.getPOI();
	if (data.player.docked_at_base) {
		client.getBase();
	}

	if (message) {
		tui.log(formatSystemMessage(message));
	}
	updateTui();
	saveSnapshot();
	startActionLoop();
}
