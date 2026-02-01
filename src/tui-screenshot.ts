// Simple script to capture TUI state to a file for debugging

import { SpaceMoltClient } from "../client/src/client";
import type {
	Base,
	LoggedInPayload,
	Player,
	POI,
	Ship,
	StateUpdatePayload,
	System,
	WelcomePayload,
} from "../client/src/types";
import { config } from "./config";
import { MemoryStore } from "./memory";
import { renderLocationPanel } from "./tui/panels/location";
import { renderPlayerShipPanel } from "./tui/panels/player-ship";
import { renderTacticalPanel } from "./tui/panels/tactical";
import { renderWorldInfoPanel } from "./tui/panels/world-info";
import type { Credentials } from "./types";

const client = new SpaceMoltClient({
	url: config.spacemoltUrl,
	debug: false,
	reconnect: false,
});

const memory = new MemoryStore(config.memoryPath);

type WorldSnapshot = {
	system?: System | null;
	poi?: POI | null;
	pois?: POI[];
	base?: Base | null;
};

let credentials: Credentials | null = null;
let cachedPlayer: Player | null = null;
let cachedShip: Ship | null = null;
const worldSnapshot: WorldSnapshot = {};

function loadCredentials(): Credentials | null {
	try {
		return memory.getCredentials();
	} catch (error) {
		console.log(`Failed to load credentials: ${(error as Error).message}`);
		process.exit(1);
	}
}

function dumpTuiState() {
	console.log(`\n${"=".repeat(80)}`);
	console.log("TUI STATE DUMP");
	console.log("=".repeat(80));
	console.log("\n--- CACHED DATA ---");
	console.log("Player:", JSON.stringify(cachedPlayer, null, 2));
	console.log("Ship:", JSON.stringify(cachedShip, null, 2));
	console.log("World Snapshot:", JSON.stringify(worldSnapshot, null, 2));

	console.log("\n--- PANEL RENDERS ---");
	console.log("\n[Player/Ship Panel]");
	console.log(
		renderPlayerShipPanel({
			player: cachedPlayer,
			ship: cachedShip,
			personality: undefined,
			tick: 0,
		}),
	);

	console.log("\n[World Info Panel]");
	console.log(
		renderWorldInfoPanel({
			base: worldSnapshot.base ?? null,
		}),
	);

	console.log("\n[Location Panel]");
	console.log(
		renderLocationPanel({
			player: cachedPlayer,
			system: worldSnapshot.system ?? null,
			poi: worldSnapshot.poi ?? null,
			pois: worldSnapshot.pois ?? [],
			traveling: false,
			travelTarget: null,
			jumping: false,
			jumpTarget: null,
		}),
	);

	console.log("\n[Tactical Panel]");
	console.log(
		renderTacticalPanel({
			inCombat: false,
			combatTarget: undefined,
			nearby: [],
		}),
	);

	console.log(`\n${"=".repeat(80)}`);
}

client.on<WelcomePayload>("welcome", async (data) => {
	console.log(`Connected to SpaceMolt v${data.version}`);

	if (credentials) {
		console.log(`Logging in as ${credentials.username}`);
		client.login(credentials.username, credentials.token);
	} else {
		console.log("No credentials found");
		process.exit(1);
	}
});

client.on<LoggedInPayload>("logged_in", (data) => {
	console.log(`Logged in as ${data.player.username}`);

	cachedPlayer = data.player;
	cachedShip = data.ship;
	worldSnapshot.system = data.system;
	worldSnapshot.poi = data.poi;

	client.getSystem();
	client.getPOI();
	if (data.player.docked_at_base) {
		client.getBase();
	}

	// Wait a bit for data to arrive, then dump state
	setTimeout(() => {
		dumpTuiState();
		process.exit(0);
	}, 3000);
});

client.on<StateUpdatePayload>("state_update", (data) => {
	if (data.player) {
		cachedPlayer = data.player;
	}
	if (data.ship) {
		cachedShip = data.ship;
	}
});

client.on("ok", (data: Record<string, unknown>) => {
	if (data.system && typeof data.system === "object") {
		worldSnapshot.system = data.system;
	}
	if (Array.isArray(data.pois)) {
		worldSnapshot.pois = data.pois;
	}
	if (data.poi && typeof data.poi === "object") {
		worldSnapshot.poi = data.poi;
	}
	if (data.base && typeof data.base === "object") {
		worldSnapshot.base = data.base;
	}
});

credentials = loadCredentials();

if (!credentials) {
	console.log("No credentials found in DB. Please run the main app first.");
	process.exit(1);
}

console.log("Connecting to SpaceMolt...");
await client.connect();
