export type MessageType =
	| "welcome"
	| "registered"
	| "logged_in"
	| "state_update"
	| "tick"
	| "ok"
	| "error"
	| "combat_update"
	| "player_died"
	| "mining_yield"
	| "scan_result"
	| "chat_message"
	| "trade_offer_received";

export interface BaseMessage {
	type: MessageType;
	payload?: unknown;
}

export interface WelcomeMessage extends BaseMessage {
	type: "welcome";
	payload: {
		version: string;
		release_date: string;
		release_notes: string[];
		tick_rate: number;
		current_tick: number;
		server_time: number;
		game_info: string;
		website: string;
		help_text: string;
		terms: string;
		motd?: string;
	};
}

export interface RegisteredMessage extends BaseMessage {
	type: "registered";
	payload: {
		token: string;
		player_id: string;
	};
}

export interface LoggedInMessage extends BaseMessage {
	type: "logged_in";
	payload: {
		player: Player;
		ship: Ship;
		system: System;
		poi: POI;
	};
}

export interface StateUpdateMessage extends BaseMessage {
	type: "state_update";
	payload: {
		tick: number;
		player: Player;
		ship: Ship;
		nearby: NearbyPlayer[];
		in_combat: boolean;
		travel_progress?: number;
		travel_destination?: string;
		travel_type?: "travel" | "jump";
		travel_arrival_tick?: number;
	};
}

export interface TickMessage extends BaseMessage {
	type: "tick";
	payload: {
		tick: number;
	};
}

export interface OkMessage extends BaseMessage {
	type: "ok";
	payload?: Record<string, unknown>;
}

export interface ErrorMessage extends BaseMessage {
	type: "error";
	payload: {
		code: string;
		message: string;
	};
}

export interface CombatUpdateMessage extends BaseMessage {
	type: "combat_update";
	payload: {
		tick: number;
		attacker: string;
		target: string;
		damage: number;
		damage_type: string;
		shield_hit: number;
		hull_hit: number;
		destroyed: boolean;
	};
}

export interface PlayerDiedMessage extends BaseMessage {
	type: "player_died";
	payload: {
		killer_id: string;
		killer_name: string;
		respawn_base: string;
		clone_cost: number;
		insurance_payout: number;
		ship_lost: string;
		wreck_id: string;
	};
}

export interface MiningYieldMessage extends BaseMessage {
	type: "mining_yield";
	payload: {
		resource_id: string;
		quantity: number;
		remaining: number;
	};
}

export interface ScanResultMessage extends BaseMessage {
	type: "scan_result";
	payload: {
		target_id: string;
		success: boolean;
		revealed_info: string[];
		username?: string;
		ship_class?: string;
		hull?: number;
		shield?: number;
	};
}

export interface ChatMessageMessage extends BaseMessage {
	type: "chat_message";
	payload: {
		id: string;
		channel: string;
		sender_id: string;
		sender: string;
		content: string;
		timestamp: string;
	};
}

export interface TradeOfferReceivedMessage extends BaseMessage {
	type: "trade_offer_received";
	payload: {
		trade_id: string;
		from_player: string;
		from_name: string;
		offer_items: TradeItem[];
		offer_credits: number;
		request_items: TradeItem[];
		request_credits: number;
	};
}

export type ServerMessage =
	| WelcomeMessage
	| RegisteredMessage
	| LoggedInMessage
	| StateUpdateMessage
	| TickMessage
	| OkMessage
	| ErrorMessage
	| CombatUpdateMessage
	| PlayerDiedMessage
	| MiningYieldMessage
	| ScanResultMessage
	| ChatMessageMessage
	| TradeOfferReceivedMessage;

export type CommandType =
	| "register"
	| "login"
	| "logout"
	| "travel"
	| "jump"
	| "dock"
	| "undock"
	| "attack"
	| "scan"
	| "mine"
	| "buy"
	| "sell"
	| "list_item"
	| "cancel_list"
	| "buy_listing"
	| "get_listings"
	| "trade_offer"
	| "trade_accept"
	| "trade_decline"
	| "trade_cancel"
	| "get_trades"
	| "get_wrecks"
	| "loot_wreck"
	| "salvage_wreck"
	| "buy_ship"
	| "install_mod"
	| "uninstall_mod"
	| "refuel"
	| "repair"
	| "craft"
	| "chat"
	| "create_faction"
	| "join_faction"
	| "leave_faction"
	| "faction_invite"
	| "faction_kick"
	| "faction_promote"
	| "buy_insurance"
	| "claim_insurance"
	| "set_home_base"
	| "set_status"
	| "set_colors"
	| "set_anonymous"
	| "get_status"
	| "get_system"
	| "get_poi"
	| "get_base"
	| "get_ship"
	| "get_skills"
	| "get_recipes"
	| "get_version"
	| "help"
	| "forum_list"
	| "forum_get_thread"
	| "forum_create_thread"
	| "forum_reply"
	| "forum_upvote"
	| "forum_delete_thread"
	| "forum_delete_reply";

export interface BaseCommand {
	type: CommandType;
	payload?: unknown;
}

export interface Player {
	id: string;
	username: string;
	empire: Empire;
	credits: number;
	current_system: string;
	current_poi: string;
	current_ship_id: string;
	home_base: string;
	docked_at_base: string | null;
	faction_id: string | null;
	faction_rank: string | null;
	status_message: string;
	clan_tag: string;
	primary_color: string;
	secondary_color: string;
	anonymous: boolean;
	skills: Record<string, SkillLevel>;
	stats: PlayerStats;
}

export interface SkillLevel {
	level: number;
	xp: number;
}

export interface PlayerStats {
	ships_destroyed: number;
	times_destroyed: number;
	ore_mined: number;
	credits_earned: number;
	credits_spent: number;
	trades_completed: number;
	systems_discovered: number;
	items_crafted: number;
	missions_completed: number;
}

export interface Ship {
	id: string;
	owner_id: string;
	class_id: string;
	name: string;
	hull: number;
	max_hull: number;
	shield: number;
	max_shield: number;
	shield_recharge: number;
	armor: number;
	speed: number;
	fuel: number;
	max_fuel: number;
	cargo_used: number;
	cargo_capacity: number;
	cpu_used: number;
	cpu_capacity: number;
	power_used: number;
	power_capacity: number;
	modules: string[];
	cargo: CargoItem[];
}

export interface CargoItem {
	item_id: string;
	quantity: number;
}

export interface System {
	id: string;
	name: string;
	description: string;
	empire: Empire;
	police_level: number;
	connections: string[];
	pois: string[];
	discovered: boolean;
	position: Position;
	discovered_by: string | null;
}

export interface Position {
	x: number;
	y: number;
}

export interface POI {
	id: string;
	system_id: string;
	type: POIType;
	name: string;
	description: string;
	position: Position;
	resources: Resource[];
	base_id: string | null;
}

export type POIType =
	| "planet"
	| "moon"
	| "sun"
	| "asteroid_belt"
	| "asteroid"
	| "nebula"
	| "gas_cloud"
	| "relic"
	| "station"
	| "jump_gate";

export interface Resource {
	resource_id: string;
	richness: number;
	remaining: number;
}

export interface NearbyPlayer {
	player_id: string;
	username: string;
	ship_class: string;
	faction_id: string | null;
	faction_tag: string;
	status_message: string;
	clan_tag: string;
	primary_color: string;
	secondary_color: string;
	anonymous: boolean;
	in_combat: boolean;
}

export interface TradeItem {
	item_id: string;
	quantity: number;
}

export type Empire = "solarian" | "voidborn" | "crimson" | "nebula" | "outerrim";

export interface Instance {
	instance_id: string;
	hint: string | null;
	logged_out: number;
}

export interface Username {
	id: number;
	username: string;
	token: string;
	prompt: string;
	player_id: string;
	instance_id: string;
	last_used_on: number;
}

export interface AccountDetails {
	username: string;
	token: string;
	player_id: string;
	prompt: string;
	hint: string | null;
}

export type MessageSender = "server" | "client";

export interface StoredMessage {
	id: number;
	tick: number;
	sender: MessageSender;
	data: string;
}

export interface ClientConfig {
	instanceId?: string;
	hint?: string;
	model?: string;
	verbose?: boolean;
	archetype?: string;
	tickRate: number;
	ollamaTimeout: number;
	serverUrl?: string;
	contextWindowSize?: number;
}

export interface ClientError {
	error: string;
	code: string;
}

export interface AccountInfo {
	username: string;
	token: string;
	is_active: boolean;
}

export interface LLMContext {
	character: string;
	hint: string | undefined;
	recent_game_messages: HistoryEntry[];
	api: APIDefinition;
	logged_in_as?: string;
	note?: string;
}

export interface HistoryEntry {
	sender: MessageSender;
	tick: number;
	data: Record<string, unknown>;
}

export interface APIDefinition {
	[command: string]: {
		args: string[];
		description: string;
	};
}
