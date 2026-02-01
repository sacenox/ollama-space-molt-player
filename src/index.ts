import type { ClientState } from "../client/src/client";
import { SpaceMoltClient } from "../client/src/client";
import type {
	CargoItem,
	ChatMessage,
	EmpireID,
	ErrorPayload,
	LoggedInPayload,
	RegisteredPayload,
	ScanResultPayload,
	StateUpdatePayload,
	WelcomePayload,
} from "../client/src/types";
import { dispatchAction, validateAction } from "./actions";
import { config } from "./config";
import { MemoryStore } from "./memory";
import { OllamaAgent, OllamaTimeoutError } from "./ollama";
import {
	buildActionPrompt,
	buildRegistrationPrompt,
	type WorldSnapshot,
} from "./prompt";
import { Tui } from "./tui";

type Credentials = { username: string; token: string };
type RegistrationChoice = { username: string; empire: EmpireID };

const memory = new MemoryStore(config.memoryPath);
const ollama = new OllamaAgent(
	config.ollamaUrl,
	config.ollamaModel,
	config.ollamaTimeoutMs,
);
const tui = new Tui(config.debug);

const client = new SpaceMoltClient({
	url: config.spacemoltUrl,
	debug: false, //config.debug,
	reconnect: true,
});

let credentials: Credentials | null = null;
let pendingRegistration: RegistrationChoice | null = null;
let actionLoopRunning = false;
const worldSnapshot: WorldSnapshot = {};
let registrationRetries = 0;
let travelInProgress = false;
let lastTravelTarget: string | null = null;
let currentGoal: string | null = null;
const MAX_REGISTRATION_RETRIES = 3;
const failedRegistrationNames: string[] = [];

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

async function saveCredentials(username: string, token: string): Promise<void> {
	const data: Credentials = { username, token };
	await Bun.write(config.credentialsFile, JSON.stringify(data, null, 2));
}

function log(message: string): void {
	tui.log(message);
}

function updateStatus(): void {
	const state = client.state;
	if (!state.player || !state.ship) {
		tui.setStatus("Not logged in");
		tui.setSidebar("Not logged in.");
		return;
	}
	const statusText = buildStatusText(
		state,
		worldSnapshot,
		travelInProgress,
		lastTravelTarget,
		currentGoal,
	);
	const sidebarText = formatSidebar(
		state,
		worldSnapshot,
		travelInProgress,
		lastTravelTarget,
	);
	tui.setStatus(statusText);
	tui.setSidebar(sidebarText);
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
	log("No credentials found. Asking LLM to create a character...");
	let attempts = 0;
	while (attempts < 3) {
		attempts += 1;
		try {
			const prompt = buildRegistrationPrompt(true, failedRegistrationNames);
			tui.setPrompt(prompt);
			const result = await ollama.generateJson<RegistrationChoice>(prompt);
			const username = String(result.json.username ?? "").trim();
			const empire = String(result.json.empire ?? "").trim() as EmpireID;
			if (!username || !isValidEmpire(empire)) {
				throw new Error("Invalid registration response");
			}
			pendingRegistration = { username, empire };
			log(`Registering new account: ${username} (${empire})`);
			client.register(username, empire);
			return;
		} catch (error) {
			log(`Registration attempt failed: ${(error as Error).message}`);
		}
	}

	const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
	pendingRegistration = { username: fallback, empire: "solarian" };
	log(`Falling back to account: ${fallback} (solarian)`);
	client.register(fallback, "solarian");
}

function isValidEmpire(empire: string): empire is EmpireID {
	return ["solarian", "voidborn", "crimson", "nebula", "outerrim"].includes(
		empire,
	);
}

async function startActionLoop(): Promise<void> {
	if (actionLoopRunning) return;
	actionLoopRunning = true;

	while (client.state.authenticated) {
		try {
			if (travelInProgress) {
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
			});

			tui.setPrompt(prompt);

			const promptExcerpt = prompt.slice(0, 1000);
			const result = await ollama.generateJson(prompt);
			const validation = validateAction(result.json);
			if (!validation.ok || !validation.action) {
				const message = `Invalid action from LLM: ${validation.error ?? "unknown"}`;
				log(message);
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
				log(message);
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
			const actionLog = dispatchAction(client, validation.action);
			log(`Action: ${actionLog}`);
			memory.appendEvent("action_sent", { action: validation.action });

			if (actionName === "travel") {
				client.getSystem();
				client.getPOI();
			}
		} catch (error) {
			const message = (error as Error).message;
			if (error instanceof OllamaTimeoutError) {
				log(`LLM timeout: ${message}. Retrying next tick.`);
				memory.appendEvent("llm_timeout", { message });
			} else {
				log(`Loop error: ${message}`);
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

function formatOkPayload(payload: Record<string, unknown>): string {
	if (payload.action) {
		return `OK ${payload.action}`;
	}
	const summary = summarizeOkPayload(payload);
	if (summary) return `OK ${summary}`;
	return `OK ${safeJson(payload)}`;
}

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return "[unserializable]";
	}
}

function summarizeOkPayload(payload: Record<string, unknown>): string | null {
	if (Array.isArray(payload.pois) && payload.pois.length > 0) {
		const system = payload.system as { id?: string; name?: string } | undefined;
		const systemLabel =
			system?.name || system?.id ? ` for ${system?.name ?? system?.id}` : "";
		return `system${systemLabel} with ${payload.pois.length} POIs`;
	}
	if (payload.poi && typeof payload.poi === "object") {
		const poi = payload.poi as { id?: string; name?: string; type?: string };
		return `poi ${poi.name ?? poi.id ?? ""}${poi.type ? ` (${poi.type})` : ""}`.trim();
	}
	if (payload.base && typeof payload.base === "object") {
		const base = payload.base as { id?: string; name?: string };
		return `base ${base.name ?? base.id ?? ""}`.trim();
	}
	if (payload.version) {
		return `version ${String(payload.version)}`;
	}
	return null;
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
	log(`Welcome: v${data.version} (tick ${data.tick_rate}s)`);
	if (data.motd) log(`MOTD: ${data.motd}`);
	memory.appendEvent("welcome", data);

	if (credentials) {
		log(`Auto-login as ${credentials.username}`);
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
		await saveCredentials(pendingRegistration.username, data.token);
		log(`Registered. Saved credentials for ${pendingRegistration.username}`);
		pendingRegistration = null;
	} else {
		log("Registered but no pending registration found.");
	}
});

client.on<LoggedInPayload>("logged_in", (data) => {
	log(`Logged in as ${data.player.username} (${data.player.empire})`);
	memory.appendEvent("logged_in", data);
	worldSnapshot.system = data.system;
	worldSnapshot.poi = data.poi;
	currentGoal = memory.getLatestGoal(data.player.username);
	client.getSystem();
	client.getPOI();
	if (data.player.docked_at_base) {
		client.getBase();
	}
	updateStatus();
	saveSnapshot();
	startActionLoop();
});

client.on<ErrorPayload>("error", (data) => {
	log(`Error [${data.code}] ${data.message}`);
	memory.appendEvent("error", data);
	if (data.code === "username_taken" && pendingRegistration) {
		if (pendingRegistration.username) {
			failedRegistrationNames.push(pendingRegistration.username);
		}
		if (registrationRetries < MAX_REGISTRATION_RETRIES) {
			registrationRetries += 1;
			log("Username taken. Requesting a new registration name...");
			pendingRegistration = null;
			runRegistrationFlow();
		} else {
			log("Username taken repeatedly. Falling back to random name.");
			const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
			pendingRegistration = { username: fallback, empire: "solarian" };
			client.register(fallback, "solarian");
		}
	}
});

client.on<StateUpdatePayload>("state_update", (data) => {
	memory.appendEvent("state_update", data);
	updateStatus();
	saveSnapshot();
	if (data.in_combat) {
		log(
			`IN COMBAT: Hull ${data.ship.hull}/${data.ship.max_hull} Shield ${data.ship.shield}/${data.ship.max_shield}`,
		);
	}
});

client.on<ChatMessage>("chat_message", (data) => {
	log(`[${data.channel}] ${data.sender}: ${data.content}`);
	memory.appendEvent("chat_message", data);
});

client.on<ScanResultPayload>("scan_result", (data) => {
	log(`Scan result: ${safeJson(data)}`);
	memory.appendEvent("scan_result", data);
});

client.on("ok", (data: Record<string, unknown>) => {
	log(formatOkPayload(data));
	memory.appendEvent("ok", data);
	updateWorldSnapshotFromOk(data);
	const action = typeof data.action === "string" ? data.action : null;
	if (action === "travel") {
		travelInProgress = true;
	}
	if (action === "arrived") {
		travelInProgress = false;
		lastTravelTarget = null;
		client.getSystem();
		client.getPOI();
	}
});

client.on("version_info", (data: Record<string, unknown>) => {
	log(`Version info: ${safeJson(data)}`);
	memory.appendEvent("version_info", data);
});

credentials = await loadCredentials();
await client.connect();
updateStatus();

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

const SIDEBAR_WIDTH = 30;
const SIDEBAR_CONTENT_WIDTH = SIDEBAR_WIDTH - 2;

function buildStatusText(
	state: ClientState,
	snapshot: WorldSnapshot,
	traveling: boolean,
	travelTargetId: string | null,
	goal: string | null,
): string {
	if (!state.player || !state.ship) return "Not logged in";
	const goalText = goal?.trim() ? ` | Goal: ${goal.trim()}` : "";
	if (traveling) {
		const destination = resolvePoiName(travelTargetId, snapshot, state);
		return `Traveling to ${destination}${goalText}`;
	}
	if (state.player.docked_at_base) return `Docked${goalText}`;
	const currentPoi = resolvePoiName(state.player.current_poi, snapshot, state);
	return `At ${currentPoi}${goalText}`;
}

function formatSidebar(
	state: ClientState,
	snapshot: WorldSnapshot,
	traveling: boolean,
	travelTargetId: string | null,
): string {
	if (!state.player || !state.ship) return "Not logged in.";

	const width = SIDEBAR_CONTENT_WIDTH;
	const lines: string[] = [];
	const pushSection = (title: string, sectionLines: string[]): void => {
		if (lines.length) lines.push("");
		const titleText = truncate(`== ${title} ==`, width);
		lines.push(`{cyan-fg}${titleText}{/cyan-fg}`);
		for (const line of sectionLines) {
			const truncated = truncate(line, width);
			const colored = colorizeLabel(truncated);
			lines.push(styleLine(colored));
		}
	};

	const system = snapshot.system ?? state.system;
	const poi = snapshot.poi ?? state.poi;
	const base = snapshot.base ?? state.base;
	const pois = snapshot.pois ?? [];

	pushSection("Player", [
		formatLine("Name", state.player.username, width),
		formatLine("Empire", state.player.empire, width),
		formatLine("Credits", String(state.player.credits), width),
		formatLine("Docked", state.player.docked_at_base ? "Y" : "N", width),
		formatLine("Tick", String(state.currentTick), width),
	]);

	pushSection("Ship", [
		formatLine("Hull", `${state.ship.hull}/${state.ship.max_hull}`, width),
		formatLine(
			"Shield",
			`${state.ship.shield}/${state.ship.max_shield}`,
			width,
		),
		formatLine("Fuel", `${state.ship.fuel}/${state.ship.max_fuel}`, width),
		formatLine(
			"Cargo",
			`${state.ship.cargo_used}/${state.ship.cargo_capacity}`,
			width,
		),
	]);

	const locationLines = [
		formatLine(
			"System",
			system?.name ?? state.player.current_system ?? "-",
			width,
		),
		formatLine("POI", poi?.name ?? state.player.current_poi ?? "-", width),
		formatLine("Travel", traveling ? "Y" : "N", width),
	];
	if (traveling) {
		locationLines.push(
			formatLine(
				"Dest",
				resolvePoiName(travelTargetId, snapshot, state),
				width,
			),
		);
	}
	pushSection("Location", locationLines);

	const poiLines = formatPoiLines(pois, system?.pois, width);
	pushSection("POIs", poiLines);

	const cargoLines = formatCargoLines(state.ship.cargo ?? [], width);
	pushSection("Cargo", cargoLines);

	const baseLines = formatBaseLines(base, width);
	pushSection("Base", baseLines);

	const nearbyLines = formatNearbyLines(state.nearby ?? [], width);
	pushSection("Nearby", nearbyLines);

	return lines.join("\n");
}

function formatLine(label: string, value: string, _width: number): string {
	return `${label}: ${value}`;
}

function truncate(value: string, width: number): string {
	if (value.length <= width) return value;
	if (width <= 3) return value.slice(0, width);
	return `${value.slice(0, width - 3)}...`;
}

function colorizeLabel(line: string): string {
	const index = line.indexOf(":");
	if (index <= 0) return line;
	const label = line.slice(0, index);
	const rest = line.slice(index);
	return `{yellow-fg}${label}{/yellow-fg}${rest}`;
}

function styleLine(line: string): string {
	if (line.includes("{")) return line;
	if (line === "none" || line === "-") return `{gray-fg}${line}{/gray-fg}`;
	return line;
}

function resolvePoiName(
	poiId: string | null | undefined,
	snapshot: WorldSnapshot,
	state: ClientState,
): string {
	if (!poiId) return "Unknown";
	const snapshotPoi = snapshot.pois?.find((entry) => entry.id === poiId);
	if (snapshotPoi?.name) return snapshotPoi.name;
	if (snapshot.poi?.id === poiId && snapshot.poi.name) return snapshot.poi.name;
	if (state.poi?.id === poiId && state.poi.name) return state.poi.name;
	return poiId;
}

function formatPoiLines(
	pois: WorldSnapshot["pois"],
	systemPois: string[] | undefined,
	width: number,
): string[] {
	if (pois && pois.length > 0) {
		const maxItems = 5;
		const lines = pois
			.slice(0, maxItems)
			.map((poi) => truncate(poi.name || poi.id, width));
		if (pois.length > maxItems) {
			lines.push(truncate(`+${pois.length - maxItems} more`, width));
		}
		return lines;
	}
	if (systemPois && systemPois.length > 0) {
		const maxItems = 5;
		const lines = systemPois
			.slice(0, maxItems)
			.map((poiId) => truncate(poiId, width));
		if (systemPois.length > maxItems) {
			lines.push(truncate(`+${systemPois.length - maxItems} more`, width));
		}
		return lines;
	}
	return ["none"];
}

function formatCargoLines(
	cargo: CargoItem[] | undefined,
	width: number,
): string[] {
	if (!cargo || cargo.length === 0) return ["none"];
	const maxItems = 6;
	const lines = cargo
		.slice(0, maxItems)
		.map((item) => truncate(`${item.item_id} x${item.quantity}`, width));
	if (cargo.length > maxItems) {
		lines.push(truncate(`+${cargo.length - maxItems} more`, width));
	}
	return lines;
}

function formatBaseLines(base: WorldSnapshot["base"], width: number): string[] {
	if (!base) return ["none"];
	const services = Object.keys(base.services)
		.filter((key) => (base.services as Record<string, boolean>)[key])
		.join(", ");
	return [
		formatLine("Name", base.name || base.id, width),
		formatLine("Services", services || "none", width),
	];
}

function formatNearbyLines(
	nearby: ClientState["nearby"],
	width: number,
): string[] {
	if (!nearby || nearby.length === 0) return ["none"];
	const maxItems = 6;
	const lines = [formatLine("Count", String(nearby.length), width)];
	for (const entry of nearby.slice(0, maxItems)) {
		const name = entry.username ?? entry.player_id ?? "unknown";
		lines.push(truncate(name, width));
	}
	if (nearby.length > maxItems) {
		lines.push(truncate(`+${nearby.length - maxItems} more`, width));
	}
	return lines;
}
