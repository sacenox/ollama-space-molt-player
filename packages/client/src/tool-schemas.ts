/**
 * Schema patches for SpaceMolt MCP tools.
 *
 * The SpaceMolt MCP server returns tools with empty inputSchema.properties,
 * which causes smaller LLMs to guess parameter names incorrectly.
 * These patches provide the correct parameter definitions based on the API docs.
 *
 * Source: https://spacemolt.com/api.md
 */

export interface SchemaProperties {
	[key: string]: {
		type: string;
		description: string;
		enum?: string[];
	};
}

export interface SchemaPatch {
	properties: SchemaProperties;
	required: string[];
}

/**
 * Schema patches for tools with parameters.
 * Tools not listed here have no parameters or use defaults.
 */
export const TOOL_SCHEMA_PATCHES: Record<string, SchemaPatch> = {
	// Authentication
	register: {
		properties: {
			username: { type: "string", description: "Username (3-20 chars, alphanumeric)" },
			empire: {
				type: "string",
				description: "Empire to join",
				enum: ["solarian", "voidborn", "crimson", "nebula", "outerrim"],
			},
		},
		required: ["username", "empire"],
	},
	login: {
		properties: {
			username: { type: "string", description: "Your username" },
			token: { type: "string", description: "Your 256-bit authentication token" },
		},
		required: ["username", "token"],
	},

	// Navigation
	travel: {
		properties: {
			target_poi: { type: "string", description: "POI ID to travel to (e.g., 'sol_belt')" },
		},
		required: ["target_poi"],
	},
	jump: {
		properties: {
			target_system: { type: "string", description: "System ID to jump to" },
		},
		required: ["target_system"],
	},

	// Combat
	attack: {
		properties: {
			target_id: { type: "string", description: "Player ID to attack" },
			weapon_idx: { type: "number", description: "Weapon module index (0-based, optional)" },
		},
		required: ["target_id"],
	},
	scan: {
		properties: {
			target_id: { type: "string", description: "Player ID to scan" },
		},
		required: ["target_id"],
	},
	cloak: {
		properties: {
			enable: { type: "boolean", description: "Enable or disable cloaking" },
		},
		required: ["enable"],
	},

	// Trading
	buy: {
		properties: {
			listing_id: { type: "string", description: "Market listing ID" },
			quantity: { type: "number", description: "Amount to buy" },
		},
		required: ["listing_id", "quantity"],
	},
	sell: {
		properties: {
			item_id: { type: "string", description: "Item ID to sell" },
			quantity: { type: "number", description: "Amount to sell" },
		},
		required: ["item_id", "quantity"],
	},
	list_item: {
		properties: {
			item_id: { type: "string", description: "Item ID to list" },
			quantity: { type: "number", description: "Amount to list" },
			price_each: { type: "number", description: "Price per unit" },
		},
		required: ["item_id", "quantity", "price_each"],
	},
	cancel_list: {
		properties: {
			listing_id: { type: "string", description: "Listing ID to cancel" },
		},
		required: ["listing_id"],
	},
	buy_listing: {
		properties: {
			listing_id: { type: "string", description: "Player listing ID" },
			quantity: { type: "number", description: "Amount to buy" },
		},
		required: ["listing_id", "quantity"],
	},

	// Player-to-Player Trading
	trade_offer: {
		properties: {
			target_id: { type: "string", description: "Target player ID" },
			offer_items: { type: "array", description: "Items to offer [{item_id, quantity}]" },
			offer_credits: { type: "number", description: "Credits to offer" },
			request_items: { type: "array", description: "Items to request [{item_id, quantity}]" },
			request_credits: { type: "number", description: "Credits to request" },
		},
		required: ["target_id"],
	},
	trade_accept: {
		properties: {
			trade_id: { type: "string", description: "Trade ID to accept" },
		},
		required: ["trade_id"],
	},
	trade_decline: {
		properties: {
			trade_id: { type: "string", description: "Trade ID to decline" },
		},
		required: ["trade_id"],
	},
	trade_cancel: {
		properties: {
			trade_id: { type: "string", description: "Trade ID to cancel" },
		},
		required: ["trade_id"],
	},

	// Wrecks
	loot_wreck: {
		properties: {
			wreck_id: { type: "string", description: "Wreck ID" },
			item_id: { type: "string", description: "Item ID to loot" },
			quantity: { type: "number", description: "Amount to loot" },
		},
		required: ["wreck_id"],
	},
	salvage_wreck: {
		properties: {
			wreck_id: { type: "string", description: "Wreck ID to salvage" },
		},
		required: ["wreck_id"],
	},

	// Ship Management
	buy_ship: {
		properties: {
			ship_class: { type: "string", description: "Ship class ID to purchase" },
		},
		required: ["ship_class"],
	},
	install_mod: {
		properties: {
			module_id: { type: "string", description: "Module ID to install" },
			slot_idx: { type: "number", description: "Slot index" },
		},
		required: ["module_id", "slot_idx"],
	},
	uninstall_mod: {
		properties: {
			slot_idx: { type: "number", description: "Slot index to uninstall from" },
		},
		required: ["slot_idx"],
	},

	// Crafting
	craft: {
		properties: {
			recipe_id: { type: "string", description: "Recipe ID to craft" },
		},
		required: ["recipe_id"],
	},

	// Chat
	chat: {
		properties: {
			channel: {
				type: "string",
				description: "Chat channel",
				enum: ["local", "system", "faction", "private"],
			},
			content: { type: "string", description: "Message content" },
			target_id: { type: "string", description: "Target player ID (for private channel)" },
		},
		required: ["channel", "content"],
	},

	// Factions
	create_faction: {
		properties: {
			name: { type: "string", description: "Faction name" },
			tag: { type: "string", description: "Faction tag (4 chars)" },
		},
		required: ["name", "tag"],
	},
	join_faction: {
		properties: {
			faction_id: { type: "string", description: "Faction ID to join" },
		},
		required: ["faction_id"],
	},
	faction_invite: {
		properties: {
			player_id: { type: "string", description: "Player ID to invite" },
		},
		required: ["player_id"],
	},
	faction_kick: {
		properties: {
			player_id: { type: "string", description: "Player ID to kick" },
		},
		required: ["player_id"],
	},
	faction_promote: {
		properties: {
			player_id: { type: "string", description: "Player ID to promote" },
			role_id: { type: "string", description: "New role ID" },
		},
		required: ["player_id", "role_id"],
	},
	faction_info: {
		properties: {
			faction_id: { type: "string", description: "Faction ID (optional, defaults to your faction)" },
		},
		required: [],
	},
	faction_list: {
		properties: {
			limit: { type: "number", description: "Max results (default 50)" },
			offset: { type: "number", description: "Pagination offset" },
		},
		required: [],
	},
	faction_decline_invite: {
		properties: {
			faction_id: { type: "string", description: "Faction ID to decline" },
		},
		required: ["faction_id"],
	},

	// Faction Diplomacy
	faction_set_ally: {
		properties: {
			target_faction_id: { type: "string", description: "Faction ID to ally with" },
		},
		required: ["target_faction_id"],
	},
	faction_set_enemy: {
		properties: {
			target_faction_id: { type: "string", description: "Faction ID to mark as enemy" },
		},
		required: ["target_faction_id"],
	},
	faction_declare_war: {
		properties: {
			target_faction_id: { type: "string", description: "Faction ID to declare war on" },
			reason: { type: "string", description: "Reason for war (optional)" },
		},
		required: ["target_faction_id"],
	},
	faction_propose_peace: {
		properties: {
			target_faction_id: { type: "string", description: "Faction ID to propose peace to" },
			terms: { type: "string", description: "Peace terms (optional)" },
		},
		required: ["target_faction_id"],
	},
	faction_accept_peace: {
		properties: {
			target_faction_id: { type: "string", description: "Faction ID to accept peace from" },
		},
		required: ["target_faction_id"],
	},

	// Insurance
	buy_insurance: {
		properties: {
			coverage_percent: { type: "number", description: "Coverage percentage (50-100)" },
		},
		required: ["coverage_percent"],
	},

	// Player Settings
	set_status: {
		properties: {
			status_message: { type: "string", description: "Status message" },
			clan_tag: { type: "string", description: "Clan tag (4 chars)" },
		},
		required: [],
	},
	set_colors: {
		properties: {
			primary_color: { type: "string", description: "Primary color (#RRGGBB)" },
			secondary_color: { type: "string", description: "Secondary color (#RRGGBB)" },
		},
		required: [],
	},
	set_anonymous: {
		properties: {
			anonymous: { type: "boolean", description: "Enable anonymous mode" },
		},
		required: ["anonymous"],
	},

	// Information Queries
	get_system: {
		properties: {
			system_id: { type: "string", description: "System ID (optional, defaults to current)" },
		},
		required: [],
	},
	get_map: {
		properties: {
			system_id: { type: "string", description: "System ID for details (optional)" },
		},
		required: [],
	},
	help: {
		properties: {
			topic: { type: "string", description: "Command name to get help for" },
		},
		required: [],
	},

	// Maps
	create_map: {
		properties: {
			name: { type: "string", description: "Map document name" },
			description: { type: "string", description: "Map description" },
			systems: { type: "array", description: "System IDs to include (empty = all)" },
		},
		required: ["name"],
	},
	use_map: {
		properties: {
			map_item_id: { type: "string", description: "Map item ID to use" },
		},
		required: ["map_item_id"],
	},

	// Notes
	create_note: {
		properties: {
			title: { type: "string", description: "Note title (max 100 chars)" },
			content: { type: "string", description: "Note content (max 10000 chars)" },
		},
		required: ["title", "content"],
	},
	write_note: {
		properties: {
			note_id: { type: "string", description: "Note ID to edit" },
			content: { type: "string", description: "New content" },
		},
		required: ["note_id", "content"],
	},
	read_note: {
		properties: {
			note_id: { type: "string", description: "Note ID to read" },
		},
		required: ["note_id"],
	},

	// Base Building
	build_base: {
		properties: {
			name: { type: "string", description: "Base name (max 32 chars)" },
			description: { type: "string", description: "Base description" },
			type: {
				type: "string",
				description: "Station type",
				enum: ["outpost", "station", "fortress"],
			},
			services: { type: "array", description: "Services to enable" },
			faction_base: { type: "boolean", description: "Build as faction base" },
		},
		required: ["name"],
	},

	// Base Raiding
	attack_base: {
		properties: {
			base_id: { type: "string", description: "Base ID to attack" },
		},
		required: ["base_id"],
	},
	loot_base_wreck: {
		properties: {
			wreck_id: { type: "string", description: "Base wreck ID" },
			item_id: { type: "string", description: "Item ID to loot" },
			quantity: { type: "number", description: "Amount to loot" },
			credits: { type: "boolean", description: "Loot credits instead of items" },
		},
		required: ["wreck_id"],
	},
	salvage_base_wreck: {
		properties: {
			wreck_id: { type: "string", description: "Base wreck ID to salvage" },
		},
		required: ["wreck_id"],
	},

	// Drones
	deploy_drone: {
		properties: {
			drone_item_id: {
				type: "string",
				description: "Drone type",
				enum: ["combat_drone", "mining_drone", "repair_drone"],
			},
			target_id: { type: "string", description: "Immediate attack target (combat only)" },
		},
		required: ["drone_item_id"],
	},
	recall_drone: {
		properties: {
			all: { type: "boolean", description: "Recall all drones" },
			drone_id: { type: "string", description: "Specific drone ID to recall" },
		},
		required: [],
	},
	order_drone: {
		properties: {
			command: {
				type: "string",
				description: "Drone command",
				enum: ["attack", "stop", "assist", "mine"],
			},
			target_id: { type: "string", description: "Target for attack/assist commands" },
		},
		required: ["command"],
	},

	// Forum
	forum_list: {
		properties: {
			page: { type: "number", description: "Page number" },
			category: { type: "string", description: "Category filter" },
		},
		required: [],
	},
	forum_get_thread: {
		properties: {
			thread_id: { type: "string", description: "Thread ID" },
		},
		required: ["thread_id"],
	},
	forum_create_thread: {
		properties: {
			title: { type: "string", description: "Thread title" },
			content: { type: "string", description: "Thread content" },
			category: { type: "string", description: "Category" },
		},
		required: ["title", "content", "category"],
	},
	forum_reply: {
		properties: {
			thread_id: { type: "string", description: "Thread ID to reply to" },
			content: { type: "string", description: "Reply content" },
		},
		required: ["thread_id", "content"],
	},
	forum_upvote: {
		properties: {
			thread_id: { type: "string", description: "Thread ID to upvote" },
			reply_id: { type: "string", description: "Reply ID to upvote" },
		},
		required: [],
	},
	forum_delete_thread: {
		properties: {
			thread_id: { type: "string", description: "Thread ID to delete" },
		},
		required: ["thread_id"],
	},
	forum_delete_reply: {
		properties: {
			reply_id: { type: "string", description: "Reply ID to delete" },
		},
		required: ["reply_id"],
	},

	// Captain's Log
	captains_log_add: {
		properties: {
			entry: { type: "string", description: "Log entry text (max 1KB)" },
		},
		required: ["entry"],
	},
	captains_log_get: {
		properties: {
			index: { type: "number", description: "Entry index (0 = newest)" },
		},
		required: ["index"],
	},

	// Notifications (MCP only)
	get_notifications: {
		properties: {
			limit: { type: "number", description: "Max notifications (default 50)" },
			types: { type: "array", description: "Filter by types: chat, combat, trade, faction, friend, forum, system" },
			clear: { type: "boolean", description: "Clear notifications after reading (default true)" },
		},
		required: [],
	},

	// Jettison
	jettison: {
		properties: {
			item_id: { type: "string", description: "Item ID to jettison" },
			quantity: { type: "number", description: "Amount to jettison" },
		},
		required: ["item_id", "quantity"],
	},

	// Friends
	add_friend: {
		properties: {
			player_id: { type: "string", description: "Player ID to add as friend" },
		},
		required: ["player_id"],
	},
	remove_friend: {
		properties: {
			player_id: { type: "string", description: "Player ID to remove" },
		},
		required: ["player_id"],
	},
	accept_friend_request: {
		properties: {
			player_id: { type: "string", description: "Player ID to accept" },
		},
		required: ["player_id"],
	},
	decline_friend_request: {
		properties: {
			player_id: { type: "string", description: "Player ID to decline" },
		},
		required: ["player_id"],
	},

	// Missions
	accept_mission: {
		properties: {
			mission_id: { type: "string", description: "Mission ID to accept" },
		},
		required: ["mission_id"],
	},
	complete_mission: {
		properties: {
			mission_id: { type: "string", description: "Mission ID to complete" },
		},
		required: ["mission_id"],
	},
	abandon_mission: {
		properties: {
			mission_id: { type: "string", description: "Mission ID to abandon" },
		},
		required: ["mission_id"],
	},
};
