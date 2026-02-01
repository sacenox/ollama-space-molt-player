import { SpaceMoltClient } from "../client/src/client";
import type {
	ChatMessage,
	EmpireID,
	ErrorPayload,
	LoggedInPayload,
	RegisteredPayload,
	ScanResultPayload,
	StateUpdatePayload,
	WelcomePayload,
} from "../client/src/types";
import {
	dispatchAction,
	PERSONALITY_ARCHETYPES,
	type PersonalityType,
	validateAction,
} from "./actions";
import { config } from "./config";
import { MemoryStore } from "./memory";
import { OllamaAgent, OllamaTimeoutError } from "./ollama";
import {
	buildActionPrompt,
	buildRegistrationPrompt,
	type WorldSnapshot,
} from "./prompt";
import { Tui } from "./tui";
import {
	formatAiAction,
	formatAiGoal,
	formatAiThinking,
	formatChatMessage,
	formatError,
	formatLoggedIn,
	formatMotd,
	formatOk,
	formatRegistered,
	formatScanResult,
	formatSystemMessage,
	formatWelcome,
} from "./tui/formatters";

type Credentials = {
	username: string;
	token: string;
	personality: PersonalityType;
};
type RegistrationChoice = {
	username: string;
	empire: EmpireID;
	personality: PersonalityType;
	personality_reason?: string;
};

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

let credentials: Credentials | null = null;
let pendingRegistration: RegistrationChoice | null = null;
let actionLoopRunning = false;
const worldSnapshot: WorldSnapshot = {};
let registrationRetries = 0;
let travelInProgress = false;
let lastTravelTarget: string | null = null;
let jumpInProgress = false;
let lastJumpTarget: string | null = null;
let currentGoal: string | null = null;
let lastSystemId: string | null = null;
let lastPoiId: string | null = null;
let lastDocked = false;
let inCombat = false;
const MAX_REGISTRATION_RETRIES = 3;
const failedRegistrationNames: string[] = [];

// Cache player/ship data since client.state doesn't maintain them
let cachedPlayer: typeof client.state.player = null;
let cachedShip: typeof client.state.ship = null;
let lastCredits: number | null = null;

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
		player: cachedPlayer,
		ship: cachedShip,
		system: worldSnapshot.system ?? state.system ?? null,
		poi: worldSnapshot.poi ?? state.poi ?? null,
		base: worldSnapshot.base ?? state.base ?? null,
		pois: worldSnapshot.pois ?? [],
		nearby: state.nearby ?? [],
		personality: credentials?.personality,
		tick: state.currentTick,
		traveling: travelInProgress,
		travelTarget: lastTravelTarget,
		jumping: jumpInProgress,
		jumpTarget: lastJumpTarget,
		goal: currentGoal,
		inCombat,
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

async function runRegistrationFlow(): Promise<void> {
	tui.log(
		formatSystemMessage(
			"No credentials found. Asking LLM to create a character...",
		),
	);
	let attempts = 0;
	while (attempts < 3) {
		attempts += 1;
		try {
			const prompt = buildRegistrationPrompt(true, failedRegistrationNames);
			tui.setPrompt(prompt);
			const result = await ollama.generateJson<RegistrationChoice>(prompt);
			if (result.thinking) {
				tui.log(formatAiThinking(result.thinking));
			}
			const username = String(result.json.username ?? "").trim();
			const empire = String(result.json.empire ?? "").trim() as EmpireID;
			const personality = String(
				result.json.personality ?? "",
			).trim() as PersonalityType;
			const personalityReason = result.json.personality_reason
				? String(result.json.personality_reason).trim()
				: undefined;
			if (
				!username ||
				!isValidEmpire(empire) ||
				!isValidPersonality(personality)
			) {
				throw new Error("Invalid registration response");
			}
			pendingRegistration = {
				username,
				empire,
				personality,
				personality_reason: personalityReason,
			};
			const personalityInfo = PERSONALITY_ARCHETYPES[personality];
			tui.log(
				formatSystemMessage(`Registering new account: ${username} (${empire})`),
			);
			tui.log(
				formatSystemMessage(
					`Chosen personality: ${personalityInfo.name}${personalityReason ? ` - ${personalityReason}` : ""}`,
				),
			);
			client.register(username, empire);
			return;
		} catch (error) {
			tui.log(
				formatSystemMessage(
					`Registration attempt failed: ${(error as Error).message}`,
				),
			);
		}
	}

	const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
	pendingRegistration = {
		username: fallback,
		empire: "solarian",
		personality: "pragmatist",
	};
	tui.log(
		formatSystemMessage(
			`Falling back to account: ${fallback} (solarian, pragmatist)`,
		),
	);
	client.register(fallback, "solarian");
}

function isValidEmpire(empire: string): empire is EmpireID {
	return ["solarian", "voidborn", "crimson", "nebula", "outerrim"].includes(
		empire,
	);
}

function isValidPersonality(
	personality: string,
): personality is PersonalityType {
	return ["explorer", "merchant", "warrior", "diplomat", "pragmatist"].includes(
		personality,
	);
}

function refreshSnapshotForLocation(player: {
	current_system?: string;
	current_poi?: string;
	docked_at_base?: string | boolean | null;
}): void {
	const systemId = player.current_system ?? null;
	const poiId = player.current_poi ?? null;
	const docked = Boolean(player.docked_at_base);
	const systemChanged = systemId && systemId !== lastSystemId;
	const poiChanged = poiId && poiId !== lastPoiId;

	if (systemChanged) {
		worldSnapshot.system = null;
		worldSnapshot.pois = [];
		worldSnapshot.poi = null;
		worldSnapshot.base = null;
		client.state.system = null;
		client.state.poi = null;
		client.state.base = null;
		client.getSystem();
		client.getPOI();
		if (docked) {
			client.getBase();
		}
	} else if (poiChanged) {
		worldSnapshot.poi = null;
		worldSnapshot.base = null;
		client.state.poi = null;
		client.state.base = null;
		client.getPOI();
		if (docked) {
			client.getBase();
		}
	}

	if (!docked && lastDocked) {
		worldSnapshot.base = null;
		client.state.base = null;
	}

	if (docked && !lastDocked && !systemChanged && !poiChanged) {
		client.getBase();
	}

	if (systemId) lastSystemId = systemId;
	if (poiId) lastPoiId = poiId;
	lastDocked = docked;
}

async function startActionLoop(): Promise<void> {
	if (actionLoopRunning) return;
	actionLoopRunning = true;

	while (client.state.authenticated) {
		try {
			if (travelInProgress || jumpInProgress) {
				await sleep(config.tickDelayMs);
				continue;
			}
			const recentHistory = memory.getRecentHistory(
				config.maxContextActions,
				config.maxContextEvents,
			);
			const prompt = buildActionPrompt({
				state: client.state,
				worldSnapshot,
				recentHistory,
				currentGoal,
				personality: credentials?.personality,
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
				currentGoal = goal;
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
				lastTravelTarget =
					String(validation.action.args?.target_poi ?? "").trim() || null;
			}
			if (actionName === "jump") {
				lastJumpTarget =
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

function isNearbyTarget(
	nearby: { player_id?: string; username?: string }[] | undefined,
	targetId: unknown,
): boolean {
	if (!nearby || nearby.length === 0) return false;
	const target = String(targetId ?? "").trim();
	if (!target) return false;
	const normalized = target.toLowerCase();
	return nearby.some((player) => {
		const id = player.player_id ? player.player_id.toLowerCase() : "";
		const name = player.username ? player.username.toLowerCase() : "";
		return normalized === id || normalized === name;
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

client.on<WelcomePayload>("welcome", async (data) => {
	tui.log(formatWelcome(data));
	if (data.motd) tui.log(formatMotd(data.motd));
	memory.appendEvent("welcome", data);

	if (credentials) {
		tui.log(formatSystemMessage(`Auto-login as ${credentials.username}`));
		client.login(credentials.username, credentials.token);
	} else {
		await runRegistrationFlow();
	}
});

client.on<RegisteredPayload>("registered", async (data) => {
	memory.appendEvent("registered", data);
	registrationRetries = 0;
	failedRegistrationNames.length = 0;
	if (pendingRegistration) {
		await saveCredentials(
			pendingRegistration.username,
			data.token,
			pendingRegistration.personality,
		);
		credentials = {
			username: pendingRegistration.username,
			token: data.token,
			personality: pendingRegistration.personality,
		};
		tui.log(formatRegistered(data));
		pendingRegistration = null;
	} else {
		tui.log(
			formatSystemMessage("Registered but no pending registration found."),
		);
	}
});

client.on<LoggedInPayload>("logged_in", (data) => {
	tui.log(formatLoggedIn(data));
	memory.appendEvent("logged_in", data);

	// Cache player and ship data
	cachedPlayer = data.player;
	cachedShip = data.ship;
	lastCredits = data.player.credits;

	worldSnapshot.system = data.system;
	worldSnapshot.poi = data.poi;
	lastSystemId = data.player.current_system ?? null;
	lastPoiId = data.player.current_poi ?? null;
	lastDocked = Boolean(data.player.docked_at_base);
	currentGoal = memory.getLatestGoal(data.player.username);
	client.getSystem();
	client.getPOI();
	if (data.player.docked_at_base) {
		client.getBase();
	}
	updateTui();
	saveSnapshot();
	startActionLoop();
});

client.on<ErrorPayload>("error", (data) => {
	tui.log(formatError(data));
	memory.appendEvent("error", data);
	if (data.code === "username_taken" && pendingRegistration) {
		if (pendingRegistration.username) {
			failedRegistrationNames.push(pendingRegistration.username);
		}
		if (registrationRetries < MAX_REGISTRATION_RETRIES) {
			registrationRetries += 1;
			tui.log(
				formatSystemMessage(
					"Username taken. Requesting a new registration name...",
				),
			);
			pendingRegistration = null;
			runRegistrationFlow();
		} else {
			tui.log(
				formatSystemMessage(
					"Username taken repeatedly. Falling back to random name.",
				),
			);
			const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
			pendingRegistration = {
				username: fallback,
				empire: "solarian",
				personality: "pragmatist",
			};
			client.register(fallback, "solarian");
		}
	}
});

client.on<StateUpdatePayload>("state_update", (data) => {
	memory.appendEvent("state_update", data);

	// Update cached player and ship data (only if provided)
	if (data.player) {
		cachedPlayer = data.player;
	}
	if (data.ship) {
		cachedShip = data.ship;
	}

	if (data.player) {
		refreshSnapshotForLocation(data.player);

		// Log state update if significant (only when credits change)
		const creditsChanged =
			lastCredits !== null && data.player.credits !== lastCredits;
		if (creditsChanged) {
			const diff = data.player.credits - (lastCredits ?? 0);
			const sign = diff > 0 ? "+" : "";
			tui.log(
				formatSystemMessage(`Credits: ${data.player.credits} (${sign}${diff})`),
			);
			lastCredits = data.player.credits;
		}
	}

	// Track combat state changes
	const wasInCombat = inCombat;
	inCombat = data.in_combat ?? false;

	// Log combat state changes
	if (inCombat && !wasInCombat) {
		tui.log(formatSystemMessage("COMBAT STARTED"));
	} else if (!inCombat && wasInCombat) {
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
	tui.log(formatOk(data));
	memory.appendEvent("ok", data);
	updateWorldSnapshotFromOk(data);

	const action = typeof data.action === "string" ? data.action : null;
	if (action === "travel") {
		travelInProgress = true;
	}
	if (action === "jump") {
		jumpInProgress = true;
	}
	if (action === "arrived") {
		travelInProgress = false;
		lastTravelTarget = null;
		client.getSystem();
		client.getPOI();
	}
	if (action === "jumped") {
		jumpInProgress = false;
		lastJumpTarget = null;
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

credentials = await loadCredentials();

console.log(`Instance: ${config.instanceName}`);
console.log(`Credentials: ${config.credentialsFile}`);
console.log(`Memory DB: ${config.memoryPath}`);

// Force re-registration if personality is missing
if (credentials && !credentials.personality) {
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
	credentials = null;
}

await client.connect();
updateTui();

function updateWorldSnapshotFromOk(data: Record<string, unknown>): void {
	if (data.system && typeof data.system === "object") {
		worldSnapshot.system = data.system as WorldSnapshot["system"];
	}
	if (Array.isArray(data.pois)) {
		worldSnapshot.pois = data.pois as WorldSnapshot["pois"];
	}
	if (data.poi && typeof data.poi === "object") {
		worldSnapshot.poi = data.poi as WorldSnapshot["poi"];
	}
	if (data.base && typeof data.base === "object") {
		worldSnapshot.base = data.base as WorldSnapshot["base"];
	}
}
