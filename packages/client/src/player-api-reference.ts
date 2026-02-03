export const PLAYER_API_REFERENCE = {
	register: { args: ["username", "empire"], description: "Auth: Create new account" },
	login: { args: ["username", "token"], description: "Auth: Login with saved credentials" },
	logout: { args: [], description: "Auth: Disconnect cleanly" },

	travel: { args: ["target_poi"], description: "Navigate: Move to POI in current system" },
	jump: { args: ["target_system"], description: "Navigate: Jump to connected system via gate" },
	dock: { args: [], description: "Navigate: Dock at station" },
	undock: { args: [], description: "Navigate: Leave station" },

	mine: { args: [], description: "Mining: Extract resources at current POI" },

	attack: { args: ["target_id", "weapon_idx?"], description: "Combat: Attack player at location" },
	scan: { args: ["target_id"], description: "Combat: Scan player for info" },
	cloak: { args: ["enable"], description: "Combat: Toggle cloaking device" },

	buy: { args: ["listing_id", "quantity"], description: "Trade: Buy from NPC market" },
	sell: { args: ["item_id", "quantity"], description: "Trade: Sell to NPC market" },
	list_item: {
		args: ["item_id", "quantity", "price_each"],
		description: "Trade: List on player market",
	},
	cancel_list: { args: ["listing_id"], description: "Trade: Cancel player listing" },
	buy_listing: { args: ["listing_id", "quantity"], description: "Trade: Buy player listing" },
	get_listings: { args: [], description: "Trade: View market listings" },

	trade_offer: {
		args: ["target_id", "offer_items", "offer_credits", "request_items", "request_credits"],
		description: "Trade: Propose direct trade",
	},
	trade_accept: { args: ["trade_id"], description: "Trade: Accept trade offer" },
	trade_decline: { args: ["trade_id"], description: "Trade: Decline trade offer" },
	trade_cancel: { args: ["trade_id"], description: "Trade: Cancel your offer" },
	get_trades: { args: [], description: "Trade: View pending trades" },

	get_wrecks: { args: [], description: "Wrecks: List wrecks at POI" },
	loot_wreck: {
		args: ["wreck_id", "item_id", "quantity"],
		description: "Wrecks: Take items from wreck",
	},
	salvage_wreck: { args: ["wreck_id"], description: "Wrecks: Destroy wreck for materials" },

	buy_ship: { args: ["ship_class"], description: "Ship: Purchase new ship (docked)" },
	install_mod: { args: ["module_id", "slot_idx"], description: "Ship: Install module (docked)" },
	uninstall_mod: { args: ["slot_idx"], description: "Ship: Remove module (docked)" },
	refuel: { args: [], description: "Ship: Refuel at station (docked)" },
	repair: { args: [], description: "Ship: Repair hull/shields (docked)" },

	craft: { args: ["recipe_id"], description: "Crafting: Craft item from materials" },

	chat: {
		args: ["channel", "content", "target_id?"],
		description: "Social: Send message (local/system/faction/private)",
	},

	create_faction: { args: ["name", "tag"], description: "Faction: Create new faction" },
	join_faction: { args: ["faction_id"], description: "Faction: Accept invitation" },
	leave_faction: { args: [], description: "Faction: Leave current faction" },
	faction_invite: { args: ["player_id"], description: "Faction: Invite player" },
	faction_kick: { args: ["player_id"], description: "Faction: Remove member" },
	faction_promote: { args: ["player_id", "role_id"], description: "Faction: Change member role" },
	faction_info: { args: ["faction_id?"], description: "Faction: View faction details" },
	faction_list: { args: ["limit?", "offset?"], description: "Faction: Browse all factions" },
	faction_get_invites: { args: [], description: "Faction: View pending invitations" },
	faction_decline_invite: { args: ["faction_id"], description: "Faction: Decline invitation" },
	faction_set_ally: { args: ["target_faction_id"], description: "Faction: Mark as ally" },
	faction_set_enemy: { args: ["target_faction_id"], description: "Faction: Mark as enemy" },
	faction_declare_war: {
		args: ["target_faction_id", "reason?"],
		description: "Faction: Declare war",
	},
	faction_propose_peace: {
		args: ["target_faction_id", "terms?"],
		description: "Faction: Propose peace",
	},
	faction_accept_peace: {
		args: ["target_faction_id"],
		description: "Faction: Accept peace proposal",
	},

	buy_insurance: { args: ["coverage_percent"], description: "Insurance: Buy ship insurance" },
	claim_insurance: { args: [], description: "Insurance: Claim payout" },
	set_home_base: { args: [], description: "Insurance: Set respawn point (docked)" },

	set_status: { args: ["status_message?", "clan_tag?"], description: "Settings: Update status" },
	set_colors: {
		args: ["primary_color", "secondary_color"],
		description: "Settings: Set ship colors",
	},
	set_anonymous: { args: ["anonymous"], description: "Settings: Toggle anonymity" },

	get_status: { args: [], description: "Info: Current player/ship status" },
	get_system: { args: [], description: "Info: Current system with connections" },
	get_poi: { args: [], description: "Info: Current location details" },
	get_base: { args: [], description: "Info: Base info (docked)" },
	get_ship: { args: [], description: "Info: Detailed ship stats" },
	get_cargo: { args: [], description: "Info: Ship cargo contents" },
	get_nearby: { args: [], description: "Info: Other players at POI" },
	get_skills: { args: [], description: "Info: All skills and progress" },
	get_recipes: { args: [], description: "Info: Available crafting recipes" },
	get_version: { args: [], description: "Info: Server version" },
	get_map: { args: ["system_id?"], description: "Info: Your discovered systems" },
	help: { args: ["topic?"], description: "Info: Get command help" },

	create_map: {
		args: ["name", "description", "systems?"],
		description: "Maps: Create tradeable map",
	},
	use_map: { args: ["map_item_id"], description: "Maps: Learn systems from map" },

	create_note: { args: ["title", "content"], description: "Notes: Create text document" },
	write_note: { args: ["note_id", "content"], description: "Notes: Edit existing note" },
	read_note: { args: ["note_id"], description: "Notes: Read note contents" },
	get_notes: { args: [], description: "Notes: List your notes" },

	build_base: {
		args: ["name", "type?", "description?", "services?", "faction_base?"],
		description: "Base: Build at current POI",
	},
	get_base_cost: { args: [], description: "Base: Get building costs" },

	attack_base: { args: ["base_id"], description: "Raid: Attack player base" },
	raid_status: { args: [], description: "Raid: View active raids" },
	get_base_wrecks: { args: [], description: "Raid: List base wrecks at POI" },
	loot_base_wreck: {
		args: ["wreck_id", "item_id?", "quantity?", "credits?"],
		description: "Raid: Loot base wreck",
	},
	salvage_base_wreck: { args: ["wreck_id"], description: "Raid: Salvage base wreck" },

	deploy_drone: { args: ["drone_item_id", "target_id?"], description: "Drones: Deploy from cargo" },
	recall_drone: { args: ["all?", "drone_id?"], description: "Drones: Recall to cargo" },
	order_drone: {
		args: ["command", "target_id?"],
		description: "Drones: Give orders (attack/stop/assist/mine)",
	},
	get_drones: { args: [], description: "Drones: View deployed drones" },

	forum_list: { args: ["page?", "category?"], description: "Forum: List threads" },
	forum_get_thread: { args: ["thread_id"], description: "Forum: Get thread with replies" },
	forum_create_thread: {
		args: ["title", "content", "category?"],
		description: "Forum: Create thread",
	},
	forum_reply: { args: ["thread_id", "content"], description: "Forum: Reply to thread" },
	forum_upvote: { args: ["thread_id?", "reply_id?"], description: "Forum: Upvote thread/reply" },
	forum_delete_thread: { args: ["thread_id"], description: "Forum: Delete your thread" },
	forum_delete_reply: { args: ["reply_id"], description: "Forum: Delete your reply" },

	captains_log_add: { args: ["entry"], description: "Log: Add journal entry" },
	captains_log_list: { args: [], description: "Log: List all entries" },
	captains_log_get: { args: ["index"], description: "Log: Get specific entry" },
};

export const VALID_COMMAND_TYPES = Object.keys(PLAYER_API_REFERENCE);
