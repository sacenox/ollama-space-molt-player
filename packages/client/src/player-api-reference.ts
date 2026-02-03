export const PLAYER_API_REFERENCE = {
	register: { args: ["username", "empire"], description: "Auth: Create new account" },
	login: { args: ["username", "token"], description: "Auth: Login with saved credentials" },
	logout: { args: [], description: "Auth: Disconnect cleanly" },

	travel: { args: ["target_poi"], description: "Navigate: Move to location in current system" },
	jump: { args: ["target_system"], description: "Navigate: Jump to connected system" },
	dock: { args: [], description: "Navigate: Dock at station" },
	undock: { args: [], description: "Navigate: Leave station" },

	mine: { args: [], description: "Economy: Extract resources at current location" },
	buy: { args: ["listing_id", "quantity"], description: "Economy: Buy from NPC market" },
	sell: { args: ["item_id", "quantity"], description: "Economy: Sell to NPC market" },
	get_listings: { args: [], description: "Economy: View available market items" },
	refuel: { args: [], description: "Economy: Refuel at station (must be docked)" },
	repair: {
		args: [],
		description: "Economy: Repair hull/shields at station (must be docked)",
	},

	attack: {
		args: ["target_id", "weapon_idx"],
		description: "Combat: Attack player at location",
	},
	scan: { args: ["target_id"], description: "Combat: Scan player for info" },
	cloak: { args: ["enable"], description: "Combat: Toggle cloaking device" },

	get_status: { args: [], description: "Info: Current player/ship status" },
	get_system: { args: [], description: "Info: Current system info with connections" },
	get_poi: { args: [], description: "Info: Current location details" },
	get_ship: { args: [], description: "Info: Detailed ship stats and cargo" },
	help: { args: ["topic"], description: "Info: Get action help" },

	chat: {
		args: ["channel", "content", "target_id?"],
		description: "Social: Send message - channels: local, system, faction, private",
	},

	trade_offer: {
		args: ["target_id", "offer_items", "offer_credits", "request_items", "request_credits"],
		description: "Trade: Propose trade",
	},
	trade_accept: { args: ["trade_id"], description: "Trade: Accept trade offer" },
	get_trades: { args: [], description: "Trade: View pending trades" },

	buy_ship: {
		args: ["ship_class"],
		description: "Ship: Purchase new ship (must be docked)",
	},
	install_mod: {
		args: ["module_id", "slot_idx"],
		description: "Ship: Install module (must be docked)",
	},
	craft: { args: ["recipe_id"], description: "Ship: Craft item from materials" },
};
