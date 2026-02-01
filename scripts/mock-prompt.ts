// Generate a mock prompt exactly as sent to the LLM
// Usage: bun run scripts/mock-prompt.ts

import type { ClientState } from "../client/src/client";
import type { HistoryEntry } from "../src/memory";
import { buildActionPrompt, type WorldSnapshot } from "../src/prompt";
import type {
	AlignmentType,
	PersonalityType,
	SpeechStyleType,
} from "../src/types";

// Mock player data
const mockPlayer = {
	id: "player-001",
	username: "NebulaWanderer",
	empire: "nebula" as const,
	credits: 15420,
	current_system: "sol-prime",
	current_poi: "asteroid-belt-alpha",
	current_ship_id: "ship-001",
	home_base: "station-central",
	docked_at_base: "",
	faction_id: "faction-nebula-explorers",
	faction_rank: "Lieutenant",
	status_message: "Exploring the cosmos",
	clan_tag: "NEB",
	primary_color: "#3366ff",
	secondary_color: "#99ccff",
	anonymous: false,
	skills: {
		mining: { level: 5, xp: 2400 },
		combat: { level: 3, xp: 800 },
		trading: { level: 4, xp: 1600 },
	},
	stats: {
		ships_destroyed: 12,
		times_destroyed: 3,
		ore_mined: 45000,
		credits_earned: 120000,
		credits_spent: 85000,
		trades_completed: 67,
		systems_discovered: 15,
		items_crafted: 23,
		missions_completed: 8,
	},
};

// Mock ship data
const mockShip = {
	id: "ship-001",
	owner_id: "player-001",
	class_id: "explorer-mk2",
	name: "Starseeker",
	hull: 85,
	max_hull: 100,
	shield: 40,
	max_shield: 50,
	shield_recharge: 2,
	armor: 15,
	speed: 120,
	fuel: 35,
	max_fuel: 100,
	cargo_used: 45,
	cargo_capacity: 80,
	cpu_used: 30,
	cpu_capacity: 50,
	power_used: 25,
	power_capacity: 40,
	modules: ["scanner-mk2", "mining-laser", "shield-booster"],
	cargo: [
		{ item_id: "iron-ore", quantity: 30 },
		{ item_id: "crystal-shard", quantity: 10 },
		{ item_id: "fuel-cell", quantity: 5 },
	],
};

// Mock system data
const mockSystem = {
	id: "sol-prime",
	name: "Sol Prime",
	description: "A bustling hub of trade and exploration.",
	empire: "nebula" as const,
	police_level: 5,
	connections: ["alpha-centauri", "tau-ceti", "barnards-star"],
	pois: ["station-central", "asteroid-belt-alpha", "gas-giant-1", "moon-alpha"],
	discovered: true,
	position: { x: 0, y: 0 },
	discovered_by: "player-001",
};

// Mock POI data
const mockPoi = {
	id: "asteroid-belt-alpha",
	system_id: "sol-prime",
	type: "asteroid_belt" as const,
	name: "Alpha Belt",
	description: "Rich asteroid belt with various ores.",
	position: { x: 150, y: 75 },
	resources: [
		{ resource_id: "iron-ore", richness: 0.8, remaining: 5000 },
		{ resource_id: "titanium", richness: 0.4, remaining: 2000 },
	],
	base_id: undefined,
};

// Mock base data (null when not docked)
const mockBase = null;

// Mock nearby players
const mockNearby = [
	{
		player_id: "player-042",
		username: "VoidHunter",
		ship_class: "fighter-mk3",
		faction_id: "faction-crimson",
		faction_tag: "CRM",
		status_message: "Looking for trouble",
		clan_tag: "CRM",
		primary_color: "#ff3333",
		secondary_color: "#990000",
		anonymous: false,
		in_combat: false,
	},
	{
		player_id: "player-088",
		username: "TradeMaster",
		ship_class: "freighter-xl",
		faction_id: undefined,
		faction_tag: undefined,
		status_message: "Open for business",
		clan_tag: undefined,
		primary_color: "#33ff33",
		secondary_color: "#009900",
		anonymous: false,
		in_combat: false,
	},
];

// Build ClientState
const mockClientState: ClientState = {
	connected: true,
	authenticated: true,
	player: mockPlayer,
	ship: mockShip,
	system: mockSystem,
	poi: mockPoi,
	base: mockBase,
	nearby: mockNearby,
	inCombat: false,
	currentTick: 12847,
};

// Mock world snapshot with POI list
const mockWorldSnapshot: WorldSnapshot = {
	system: mockSystem,
	pois: [
		{
			id: "station-central",
			name: "Central Station",
			type: "station",
			position: { x: 0, y: 0 },
			base_id: "base-central",
		},
		{
			id: "asteroid-belt-alpha",
			name: "Alpha Belt",
			type: "asteroid_belt",
			position: { x: 150, y: 75 },
			resources: [
				{ resource_id: "iron-ore", richness: 0.8, remaining: 5000 },
				{ resource_id: "titanium", richness: 0.4, remaining: 2000 },
			],
		},
		{
			id: "gas-giant-1",
			name: "Helios Major",
			type: "planet",
			position: { x: -200, y: 100 },
		},
		{
			id: "moon-alpha",
			name: "Luna Prime",
			type: "moon",
			position: { x: 50, y: -30 },
			base_id: "base-luna",
		},
	],
	poi: mockPoi,
	base: mockBase,
};

// Mock recent history
const mockRecentHistory: HistoryEntry[] = [
	{
		kind: "action",
		ts: "2024-01-15T10:30:00Z",
		action: "travel",
		args: JSON.stringify({ target_poi: "asteroid-belt-alpha" }),
	},
	{
		kind: "event",
		ts: "2024-01-15T10:30:05Z",
		type: "ok",
		payload: JSON.stringify({
			action: "arrived",
			poi_id: "asteroid-belt-alpha",
		}),
	},
	{
		kind: "action",
		ts: "2024-01-15T10:31:00Z",
		action: "mine",
		args: null,
	},
	{
		kind: "event",
		ts: "2024-01-15T10:31:05Z",
		type: "ok",
		payload: JSON.stringify({
			action: "mine",
			resource: "iron-ore",
			quantity: 15,
		}),
	},
	{
		kind: "action",
		ts: "2024-01-15T10:32:00Z",
		action: "mine",
		args: null,
	},
	{
		kind: "event",
		ts: "2024-01-15T10:32:05Z",
		type: "ok",
		payload: JSON.stringify({
			action: "mine",
			resource: "iron-ore",
			quantity: 12,
		}),
	},
	{
		kind: "action",
		ts: "2024-01-15T10:33:00Z",
		action: "say",
		args: JSON.stringify({ content: "Good yields here today!" }),
	},
	{
		kind: "event",
		ts: "2024-01-15T10:33:02Z",
		type: "chat_message",
		payload: JSON.stringify({
			channel: "local",
			sender: "VoidHunter",
			content: "Watch your back, explorer.",
		}),
	},
];

// Mock character traits
const mockAlignment: AlignmentType = "good";
const mockPersonality: PersonalityType = "cartographer";
const mockSpeechStyle: SpeechStyleType = "mythic";

// Mock forum context
const mockLastForumThreadId: string | null = "thread-abc123";
const mockLastForumPostTitle: string | null = "Best Mining Spots in Sol Prime";
const mockLastForumPostCategory: string | null = "trading";
const mockForumFollowUpStatus: "unread" | "periodic" | null = "periodic";

// Mock repetition warning (null = no warning)
const mockRepetitionWarning: { action: string; count: number } | null = null;
const mockMemorySummary =
	"Recently traveled to the asteroid belt and mined resources while staying alert for nearby activity.";
const mockLastActionResult =
	"Action: 2025-01-01T00:00:00.000Z mine\nResult:\n- Mined 5x iron_ore";

// Build the prompt exactly as we would in production
const prompt = buildActionPrompt({
	state: mockClientState,
	worldSnapshot: mockWorldSnapshot,
	recentHistory: mockRecentHistory,
	memorySummary: mockMemorySummary,
	lastActionResult: mockLastActionResult,
	currentGoal:
		"Map the Sol Prime system and gather resources for the journey to Alpha Centauri",
	empire: mockPlayer.empire,
	alignment: mockAlignment,
	personality: mockPersonality,
	speechStyle: mockSpeechStyle,
	lastForumThreadId: mockLastForumThreadId,
	lastForumPostTitle: mockLastForumPostTitle,
	lastForumPostCategory: mockLastForumPostCategory,
	forumFollowUpStatus: mockForumFollowUpStatus,
	repetitionWarning: mockRepetitionWarning,
});

// Output verbatim
console.log(prompt);
