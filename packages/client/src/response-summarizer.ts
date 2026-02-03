/**
 * Response summarizer for tool results.
 *
 * Reduces token count in LLM context by extracting only essential information
 * from verbose tool responses. This helps prevent "lost in the middle" problems
 * and allows more effective use of the context window.
 */

type SummarizerFn = (content: unknown) => unknown;

/**
 * Summarize a tool result for inclusion in LLM context.
 * Errors are always preserved in full for learning value.
 */
export function summarizeToolResult(toolName: string, content: unknown, success: boolean): unknown {
	// Always preserve error messages in full
	if (!success) {
		return content;
	}

	// Apply tool-specific summarizer if available
	const summarizer = TOOL_SUMMARIZERS[toolName];
	if (summarizer) {
		try {
			return summarizer(content);
		} catch {
			// If summarization fails, return original
			return content;
		}
	}

	// Default: apply generic summarization
	return summarizeGeneric(content);
}

/**
 * Generic summarizer for unknown tool responses.
 * Removes common verbose fields and truncates arrays.
 */
function summarizeGeneric(content: unknown): unknown {
	if (!content || typeof content !== "object") {
		return content;
	}

	if (Array.isArray(content)) {
		// Truncate arrays to first 5 items with simplified entries
		return content.slice(0, 5).map((item) => summarizeGeneric(item));
	}

	const obj = content as Record<string, unknown>;
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		// Skip verbose/redundant fields
		if (SKIP_FIELDS.has(key)) {
			continue;
		}

		// Recursively summarize nested objects
		if (value && typeof value === "object") {
			result[key] = summarizeGeneric(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Fields to skip in generic summarization.
 * These are typically verbose, redundant, or not useful for decision-making.
 */
const SKIP_FIELDS = new Set([
	// Timestamps (rarely needed for decisions)
	"created_at",
	"last_login_at",
	"last_active_at",
	"joined_at",
	"last_seen",
	"timestamp",
	"discovered_at",
	// Colors (cosmetic)
	"primary_color",
	"secondary_color",
	// Empty or default values
	"status_message",
	"clan_tag",
	"description",
	// Detailed stats (rarely needed in-flight)
	"stats",
	"skill_xp",
	"skills",
	"experience",
	// Full discovery data (too verbose)
	"discovered_systems",
	// Position data (usually not needed)
	"position",
]);

/**
 * Tool-specific summarizers.
 * Each function extracts only the fields essential for LLM decision-making.
 */
const TOOL_SUMMARIZERS: Record<string, SummarizerFn> = {
	// Status tools - extract key decision-making info
	get_status: (content) => {
		const c = content as Record<string, unknown>;
		const player = c.player as Record<string, unknown> | undefined;
		const ship = c.ship as Record<string, unknown> | undefined;

		return {
			player: player
				? {
						username: player.username,
						credits: player.credits,
						current_system: player.current_system,
						current_poi: player.current_poi,
						docked_at_base: player.docked_at_base || null,
						home_base: player.home_base,
					}
				: undefined,
			ship: ship
				? {
						name: ship.name,
						class_id: ship.class_id,
						hull: ship.hull,
						max_hull: ship.max_hull,
						fuel: ship.fuel,
						max_fuel: ship.max_fuel,
						cargo_used: ship.cargo_used,
						cargo_capacity: ship.cargo_capacity,
						modules: ship.modules,
					}
				: undefined,
		};
	},

	// Registration - extract essentials, password already logged separately
	register: (content) => {
		const c = content as Record<string, unknown>;
		const player = c.player as Record<string, unknown> | undefined;
		const ship = c.ship as Record<string, unknown> | undefined;
		const system = c.system as Record<string, unknown> | undefined;
		const poi = c.poi as Record<string, unknown> | undefined;

		return {
			message: c.message,
			player_id: c.player_id,
			player: player
				? {
						username: player.username,
						empire: player.empire,
						credits: player.credits,
						current_system: player.current_system,
						current_poi: player.current_poi,
						docked_at_base: player.docked_at_base,
					}
				: undefined,
			ship: ship
				? {
						name: ship.name,
						class_id: ship.class_id,
						hull: ship.hull,
						max_hull: ship.max_hull,
						fuel: ship.fuel,
						max_fuel: ship.max_fuel,
					}
				: undefined,
			system: system
				? {
						id: system.id,
						name: system.name,
						connections: system.connections,
						pois: system.pois,
					}
				: undefined,
			poi: poi
				? {
						id: poi.id,
						name: poi.name,
						type: poi.type,
						base_id: poi.base_id,
					}
				: undefined,
			password: c.password,
		};
	},

	// Login - similar to register
	login: (content) => {
		const c = content as Record<string, unknown>;
		const player = c.player as Record<string, unknown> | undefined;
		const ship = c.ship as Record<string, unknown> | undefined;

		return {
			message: c.message,
			player: player
				? {
						username: player.username,
						credits: player.credits,
						current_system: player.current_system,
						current_poi: player.current_poi,
						docked_at_base: player.docked_at_base,
					}
				: undefined,
			ship: ship
				? {
						name: ship.name,
						hull: ship.hull,
						max_hull: ship.max_hull,
						fuel: ship.fuel,
						max_fuel: ship.max_fuel,
					}
				: undefined,
		};
	},

	// Nearby players - just username and key identifiers
	get_nearby: (content) => {
		const c = content as Record<string, unknown>;
		const nearby = c.nearby as Array<Record<string, unknown>> | undefined;

		return {
			count: c.count,
			nearby: nearby
				? nearby.slice(0, 10).map((p) => ({
						username: p.username,
						player_id: p.player_id,
						ship_class: p.ship_class,
						in_combat: p.in_combat,
					}))
				: [],
		};
	},

	// Notifications - keep type and essential content
	get_notifications: (content) => {
		const c = content as Record<string, unknown>;
		const notifications = c.notifications as Array<Record<string, unknown>> | undefined;

		return {
			count: c.count,
			remaining: c.remaining,
			notifications: notifications
				? notifications.slice(0, 10).map((n) => ({
						type: n.type,
						message: n.message,
						data: n.data,
					}))
				: [],
		};
	},

	// Navigation actions - keep just the outcome
	travel: (content) => {
		const c = content as Record<string, unknown>;
		return {
			action: c.action || "travel",
			ticks: c.ticks,
			destination: c.destination || c.target_poi,
			message: c.message,
		};
	},

	jump: (content) => {
		const c = content as Record<string, unknown>;
		return {
			action: c.action || "jump",
			ticks: c.ticks,
			destination: c.destination || c.target_system,
			message: c.message,
		};
	},

	dock: (content) => {
		const c = content as Record<string, unknown>;
		return {
			action: c.action || "dock",
			base_id: c.base_id,
			base_name: c.base_name,
			message: c.message,
		};
	},

	undock: (content) => {
		const c = content as Record<string, unknown>;
		return {
			action: c.action || "undock",
			message: c.message,
		};
	},

	// Combat actions
	attack: (content) => {
		const c = content as Record<string, unknown>;
		return {
			action: c.action || "attack",
			target: c.target,
			damage: c.damage,
			result: c.result,
			message: c.message,
		};
	},

	mine: (content) => {
		const c = content as Record<string, unknown>;
		return {
			action: c.action || "mine",
			ore_type: c.ore_type,
			quantity: c.quantity,
			message: c.message,
		};
	},

	// System info - key navigation data only
	get_system: (content) => {
		const c = content as Record<string, unknown>;
		return {
			id: c.id,
			name: c.name,
			empire: c.empire,
			connections: c.connections,
			pois: c.pois,
			police_level: c.police_level,
		};
	},

	get_poi: (content) => {
		const c = content as Record<string, unknown>;
		return {
			id: c.id,
			name: c.name,
			type: c.type,
			system_id: c.system_id,
			base_id: c.base_id || null,
		};
	},

	// Faction info - essential data
	faction_info: (content) => {
		const c = content as Record<string, unknown>;
		const members = c.members as Array<Record<string, unknown>> | undefined;

		return {
			id: c.id,
			name: c.name,
			tag: c.tag,
			leader_username: c.leader_username,
			member_count: c.member_count,
			members: members
				? members.slice(0, 5).map((m) => ({
						username: m.username,
						role: m.role,
					}))
				: undefined,
			is_member: c.is_member,
			at_war: c.at_war,
		};
	},

	create_faction: (content) => {
		const c = content as Record<string, unknown>;
		return {
			action: c.action || "create_faction",
			faction_id: c.faction_id,
			name: c.name,
		};
	},

	// Chat - already compact, just ensure structure
	chat: (content) => {
		const c = content as Record<string, unknown>;
		const notification = c.notification as Record<string, unknown> | undefined;
		const message = notification?.Message as Record<string, unknown> | undefined;

		return {
			message: c.message,
			sent_at: c.sent_at,
			channel: notification?.Channel,
			content: message?.content,
		};
	},

	// Forum
	forum_list: (content) => {
		const c = content as Record<string, unknown>;
		const threads = c.threads as Array<Record<string, unknown>> | undefined;

		return {
			count: c.count,
			threads: threads
				? threads.slice(0, 5).map((t) => ({
						id: t.id,
						title: t.title,
						author: t.author,
						replies: t.reply_count || t.replies,
					}))
				: [],
		};
	},

	forum_get_thread: (content) => {
		const c = content as Record<string, unknown>;
		const replies = c.replies as Array<Record<string, unknown>> | undefined;

		return {
			id: c.id,
			title: c.title,
			author: c.author,
			content: c.content,
			reply_count: replies?.length || c.reply_count,
			replies: replies
				? replies.slice(0, 5).map((r) => ({
						author: r.author,
						content: typeof r.content === "string" ? r.content.slice(0, 200) : r.content,
					}))
				: [],
		};
	},

	forum_create_thread: (content) => {
		const c = content as Record<string, unknown>;
		return {
			message: c.message,
			thread_id: c.thread_id,
			title: c.title,
		};
	},

	forum_reply: (content) => {
		const c = content as Record<string, unknown>;
		return {
			message: c.message,
			reply_id: c.reply_id,
		};
	},

	// Market
	get_market: (content) => {
		const c = content as Record<string, unknown>;
		const listings = c.listings as Array<Record<string, unknown>> | undefined;

		return {
			count: c.count,
			listings: listings
				? listings.slice(0, 10).map((l) => ({
						id: l.id,
						item_id: l.item_id,
						item_name: l.item_name,
						quantity: l.quantity,
						price: l.price,
						seller: l.seller,
					}))
				: [],
		};
	},

	// Ship management
	get_ship: (content) => {
		const c = content as Record<string, unknown>;
		const modules = c.modules as Array<Record<string, unknown>> | undefined;
		const cargo = c.cargo as Array<Record<string, unknown>> | undefined;

		return {
			id: c.id,
			name: c.name,
			class_id: c.class_id,
			hull: c.hull,
			max_hull: c.max_hull,
			shield: c.shield,
			max_shield: c.max_shield,
			fuel: c.fuel,
			max_fuel: c.max_fuel,
			cargo_used: c.cargo_used,
			cargo_capacity: c.cargo_capacity,
			modules: modules
				? modules.map((m) => ({
						id: m.id,
						type: m.type,
						name: m.name,
					}))
				: c.modules,
			cargo: cargo
				? cargo.map((item) => ({
						id: item.id,
						name: item.name,
						quantity: item.quantity,
					}))
				: [],
		};
	},

	// Captain's log
	captains_log_add: (content) => {
		const c = content as Record<string, unknown>;
		return {
			message: c.message,
			entry_id: c.entry_id,
		};
	},

	captains_log_get: (content) => {
		const c = content as Record<string, unknown>;
		return {
			entry: c.entry,
			index: c.index,
		};
	},

	// Help - keep full content (it's instructional)
	help: (content) => content,
};
