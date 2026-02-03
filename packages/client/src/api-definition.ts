import type { APIDefinition } from "./types.ts";

export const GAME_API: APIDefinition = {
	register: {
		args: ["username", "empire"],
		description:
			"Register a new character. Empire options: solarian, voidborn, crimson, nebula, outerrim. Note: Currently only 'solarian' is available for new players.",
	},
	login: {
		args: ["username", "token"],
		description: "Login to existing account using saved credentials.",
	},
	logout: {
		args: [],
		description: "Disconnect and save state.",
	},

	travel: {
		args: ["target_poi"],
		description:
			"Travel to a point of interest in the current system. Use POI ID from current system.",
	},
	jump: {
		args: ["target_system"],
		description:
			"Jump to an adjacent system. Takes 5 ticks and consumes 5 fuel. Use system ID from current system's connections.",
	},
	dock: {
		args: [],
		description: "Dock at current POI's station if available.",
	},
	undock: {
		args: [],
		description: "Leave docked station.",
	},

	attack: {
		args: ["target_id", "weapon_idx"],
		description:
			"Attack a player at current location. Target must be nearby. Weapon index starts at 0.",
	},
	scan: {
		args: ["target_id"],
		description: "Scan a player to reveal information about their ship.",
	},

	mine: {
		args: [],
		description: "Extract resources from current POI if it contains mineable resources.",
	},

	buy: {
		args: ["listing_id", "quantity"],
		description: "Buy items from NPC market at current station.",
	},
	sell: {
		args: ["item_id", "quantity"],
		description: "Sell items from cargo to NPC market at current station for credits.",
	},
	list_item: {
		args: ["item_id", "quantity", "price_each"],
		description: "List items on player marketplace. Other players can purchase them.",
	},
	cancel_list: {
		args: ["listing_id"],
		description: "Cancel your marketplace listing and retrieve items.",
	},
	buy_listing: {
		args: ["listing_id", "quantity"],
		description: "Purchase items from another player's marketplace listing.",
	},
	get_listings: {
		args: [],
		description:
			"View all market listings at current station. Returns both NPC and player listings.",
	},

	trade_offer: {
		args: ["target_id", "offer_items", "offer_credits", "request_items", "request_credits"],
		description: "Propose a trade with another player. Items format: [{item_id, quantity}]",
	},
	trade_accept: {
		args: ["trade_id"],
		description: "Accept a trade offer from another player.",
	},
	trade_decline: {
		args: ["trade_id"],
		description: "Decline a trade offer.",
	},
	trade_cancel: {
		args: ["trade_id"],
		description: "Cancel a trade offer you initiated.",
	},
	get_trades: {
		args: [],
		description: "View all pending trade offers.",
	},

	get_wrecks: {
		args: [],
		description: "List ship wrecks at current POI that can be looted.",
	},
	loot_wreck: {
		args: ["wreck_id", "item_id", "quantity"],
		description: "Take specific items from a wreck.",
	},
	salvage_wreck: {
		args: ["wreck_id"],
		description: "Destroy wreck completely and receive salvage materials.",
	},

	buy_ship: {
		args: ["ship_class"],
		description: "Purchase a new ship at current station. Must be docked at a station.",
	},
	install_mod: {
		args: ["module_id", "slot_idx"],
		description: "Install a module into ship. Must be docked. Module must be in cargo.",
	},
	uninstall_mod: {
		args: ["slot_idx"],
		description: "Remove a module from ship. Module goes to cargo.",
	},
	refuel: {
		args: [],
		description: "Refuel ship to maximum capacity. Must be docked at station.",
	},
	repair: {
		args: [],
		description: "Repair hull and shield damage. Must be docked at station.",
	},

	craft: {
		args: ["recipe_id"],
		description:
			"Craft an item using a recipe. Consumes materials from cargo. Must have required skill level.",
	},

	chat: {
		args: ["channel", "content", "target_id?"],
		description:
			"Send chat message. Channels: local, system, faction, private. Private requires target_id.",
	},

	create_faction: {
		args: ["name", "tag"],
		description: "Create a new faction. Tag must be 4 characters. Costs credits.",
	},
	join_faction: {
		args: ["faction_id"],
		description: "Accept invitation to join a faction.",
	},
	leave_faction: {
		args: [],
		description: "Leave current faction.",
	},
	faction_invite: {
		args: ["player_id"],
		description: "Invite a player to your faction. Requires permissions.",
	},
	faction_kick: {
		args: ["player_id"],
		description: "Remove a member from faction. Requires permissions.",
	},
	faction_promote: {
		args: ["player_id", "role_id"],
		description: "Change a member's role. Requires permissions.",
	},

	buy_insurance: {
		args: ["coverage_percent"],
		description: "Purchase ship insurance. Coverage: 50-100%. Pays out if ship is destroyed.",
	},
	claim_insurance: {
		args: [],
		description: "Claim insurance payout after ship destruction.",
	},
	set_home_base: {
		args: [],
		description: "Set current station as respawn point. Must be docked at station.",
	},

	set_status: {
		args: ["status_message", "clan_tag"],
		description: "Update status message and clan tag visible to other players.",
	},
	set_colors: {
		args: ["primary_color", "secondary_color"],
		description: "Set ship colors. Format: #RRGGBB hex colors.",
	},
	set_anonymous: {
		args: ["anonymous"],
		description: "Toggle anonymity. When true, hides most information from other players.",
	},

	get_status: {
		args: [],
		description: "Get current player and ship status. Includes credits, location, ship stats.",
	},
	get_system: {
		args: [],
		description:
			"Get detailed information about current star system. Includes POIs and connections.",
	},
	get_poi: {
		args: [],
		description:
			"Get information about current point of interest. Includes resources and nearby players.",
	},
	get_base: {
		args: [],
		description: "Get station information. Must be docked. Shows available services and inventory.",
	},
	get_ship: {
		args: [],
		description: "Get detailed ship information. Includes all stats, modules, and cargo.",
	},
	get_skills: {
		args: [],
		description:
			"Get complete skill tree with all 89 skills, requirements, and your current levels.",
	},
	get_recipes: {
		args: [],
		description: "Get all available crafting recipes and their requirements.",
	},
	get_version: {
		args: [],
		description: "Get server version and game information.",
	},
	help: {
		args: ["topic?"],
		description: "Get help about a specific command or general game help.",
	},

	forum_list: {
		args: ["page", "category"],
		description: "List forum threads. Categories: general, trading, factions, guides, bugs.",
	},
	forum_get_thread: {
		args: ["thread_id"],
		description: "Get full thread with all replies.",
	},
	forum_create_thread: {
		args: ["title", "content", "category"],
		description: "Create a new forum thread.",
	},
	forum_reply: {
		args: ["thread_id", "content"],
		description: "Reply to a forum thread.",
	},
	forum_upvote: {
		args: ["thread_id?", "reply_id?"],
		description: "Upvote a thread or reply. Provide one ID.",
	},
	forum_delete_thread: {
		args: ["thread_id"],
		description: "Delete your own forum thread.",
	},
	forum_delete_reply: {
		args: ["reply_id"],
		description: "Delete your own forum reply.",
	},
};
