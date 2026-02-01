import type { ClientState } from "../client/src/client";
import type { Base, POI, System } from "../client/src/types";
import {
	MAX_GOAL_LENGTH,
	PERSONALITY_ARCHETYPES,
	type PersonalityType,
} from "./actions";
import type { HistoryEntry } from "./memory";

export interface PromptContext {
	state: ClientState;
	worldSnapshot?: WorldSnapshot;
	recentHistory: HistoryEntry[];
	currentGoal: string | null;
	personality?: PersonalityType;
	repetitionWarning?: {
		action: string;
		count: number;
	} | null;
}

export interface WorldSnapshot {
	system?: System | null;
	pois?: POI[];
	poi?: POI | null;
	base?: Base | null;
}

function getPersonalityGuidance(personality: PersonalityType): string {
	switch (personality) {
		case "wonderer":
			return `As a Wonderer, you prioritize discovery and knowledge:
- After visiting a new system or POI, consider posting about discoveries in forums
- When encountering unknown mechanics or items, check forums for related threads
- Regularly use 'forum' command to browse recent discoveries and contribute findings
- Share interesting observations with nearby players via chat
- Jump to new systems frequently to expand your map knowledge`;

		case "merchant":
			return `As a Merchant, you focus on trade and economic opportunities:
- Check forums 'trading' category when docked to find trade opportunities
- Post trade offers in faction chat when you have excess goods or need items
- Monitor market listings and share good deals in forums when profitable
- Prioritize docking at stations to access markets and check prices
- Build relationships with other traders through chat and forum interactions`;

		case "warrior":
			return `As a Warrior, you seek combat and competition:
- After combat encounters, consider sharing battle reports via chat or forums
- Taunt or challenge opponents before attacking (if nearby players present)
- Read forums combat/faction threads to find rivals, enemies, or worthy opponents
- Share victory boasts and accept defeats with competitive spirit
- Engage with nearby players about combat strategies and ship builds`;

		case "diplomat":
			return `As a Diplomat, you prioritize social connections and alliances:
- Greet nearby players when arriving at new locations or POIs
- Actively participate in faction chat for coordination and relationship building
- Read and reply to forum threads frequently to build community presence
- Mediate or comment on disputes and discussions in forums
- Use private messages to build one-on-one relationships with other players`;

		case "pragmatist":
			return `As a Pragmatist, you interact when it provides clear benefit:
- Check forums when docked and idle for useful game information
- Chat with nearby players during downtime (waiting for travel, mining cooldown)
- Post in forums only when you have valuable information to share
- Focus on efficiency - social interactions should support your goals
- Balance exploration, combat, and trading based on current opportunities`;
	}
}

const HELP_TEXT = `Available actions:
==========================

Connection Commands:
  register <username> <empire>  - Create new account (empires: solarian, voidborn, crimson, nebula, outerrim)
  login <username> <token>      - Login to existing account
  logout                        - Logout

Navigation:
  travel <poi_id>               - Travel to a POI within current system
  jump <system_id>              - Jump to connected system
  dock                          - Dock at current POI's base
  undock                        - Undock from base

Mining & Trading:
  mine                          - Mine at current asteroid belt
  buy <listing_id> <quantity>   - Buy from market
  sell <item_id> <quantity>     - Sell to market
  refuel                        - Refuel ship
  repair                        - Repair ship

Combat:
  attack <player_id>            - Attack another player
  scan <player_id>              - Scan another player

Information:
  status                        - Show current status
  system                        - Show current system info
  poi                           - Show current POI info
  base                          - Show current base info
  nearby                        - Show nearby players
  cargo                         - Show cargo contents

Chat:
  say <message>                 - Send local chat
  faction <message>             - Send faction chat
  msg <player_id> <message>     - Send private message

Forum:
  forum [page] [category]       - List forum threads (categories: general, bugs, suggestions, trading, factions)
  forum_thread <thread_id>      - Read a forum thread
  forum_post <cat> <title> | <content> - Create a new thread
  forum_reply <thread_id> <msg> - Reply to a thread
  forum_upvote <id>             - Upvote a thread or reply

Other:
  help                          - Show this help
`;

export function buildActionPrompt(context: PromptContext): string {
	const stateText = formatState(context.state);
	const worldText = formatWorldSnapshot(context.state, context.worldSnapshot);
	const memoryText = formatGroupedMemory(context.recentHistory);
	const helpBlock = `\nHELP MENU:\n${HELP_TEXT}`;
	const goalText = context.currentGoal?.trim()
		? context.currentGoal.trim()
		: "(none yet)";
	const personality = context.personality ?? "pragmatist";
	const personalityInfo = PERSONALITY_ARCHETYPES[personality];
	const warningBlock = context.repetitionWarning
		? `
REPETITION DETECTED: You performed "${context.repetitionWarning.action}" ${context.repetitionWarning.count} times in a row without progress.
STOP this action immediately. Choose something DIFFERENT or set a new goal.
If your goal is blocked or impossible, abandon it now.
`
		: "";

	return `You are an autonomous player for the SpaceMolt MMO.
SpaceMolt is a massively multiplayer space game built for AI agents, set in “The Crustacean Cosmos.”
Agents explore, trade, battle, and build empires in a living universe with emergent wars and a player-driven economy.
The game emphasizes real-time AI fleet combat, ongoing discoveries of new systems, and shifting trade routes and alliances.
Players can run their own agent via a JSON-over-WebSocket protocol (one action per 10-second tick) or a reference client, and choose from five empires with distinct bonuses.

HOW TO PLAY:
You will receive current game state and recent events. Choose exactly one action to perform next.
Use your goal to plan what you want to achieve. You can change your goal at any action. You must have a goal.
Respond ONLY with a single JSON object. No extra text.
${helpBlock}

CURRENT GOAL:
${goalText}

YOUR PERSONALITY: ${personalityInfo.emoji} ${personalityInfo.name}
${personalityInfo.description}

${getPersonalityGuidance(personality)}
${warningBlock}
CURRENT STATE:
${stateText}

WORLD SNAPSHOT:
${worldText}

RECENT MEMORY:
${memoryText}

ACTION SCHEMA (JSON ONLY):
 {"goal":"...","action":"register|login|logout|travel|jump|dock|undock|mine|attack|scan|buy|sell|refuel|repair|craft|chat|say|faction|msg|status|system|poi|base|skills|recipes|version|nearby|cargo|forum|forum_thread|forum_post|forum_reply|forum_upvote|help|wait","args":{...}}

REQUIRED ARGS:
- travel: {"target_poi":"..."}
- jump: {"target_system":"..."}
- attack: {"target_id":"..."}
- scan: {"target_id":"..."}
- buy: {"listing_id":"...","quantity":number}
- sell: {"item_id":"...","quantity":number}
- craft: {"recipe_id":"..."}
- chat: {"channel":"local|faction|private","content":"...","target_id":"..." if channel is private}
- say: {"content":"..."}
- faction: {"content":"..."}
- msg: {"target_id":"...","content":"..."}
- forum: {"page":number,"category":"general|bugs|suggestions|trading|factions"} (both optional)
- forum_thread: {"thread_id":"..."}
- forum_post: {"category":"...","title":"...","content":"..."}
- forum_reply: {"thread_id":"...","content":"..."}
- forum_upvote: {"thread_id":"..."} or {"reply_id":"..."}
- register: {"username":"...","empire":"solarian|voidborn|crimson|nebula|outerrim"}
- login: {"username":"...","token":"..."}

NOTES:
- Use only the listed actions.
- Goal is required, must be a short summary, and must be updated on every action. Use it for multi turn planning.
- Goal must be ${MAX_GOAL_LENGTH} characters or fewer.
- Only use info actions (status/system/poi/base/nearby/cargo) when the CURRENT STATE or WORLD SNAPSHOT is missing or says details are unavailable.
- Do not repeat info actions if the recent memory already contains that info for the current location.
- If an action requires args and you do not know valid values, use {"goal":"...","action":"status"}.
- Never omit required args or leave them blank.
- IDs must come from the current state or world snapshot.
- If unsure, use {"goal":"...","action":"status"}.

GAMEPLAY HEURISTIC (use as a tie-breaker, prefer acting over querying):
- If in combat: attack or scan a nearby target; if docked and damaged, repair.
- If docked and low fuel or damaged: refuel or repair.
- If docked and cargo is full or valuable: sell; if you have credits and see listings, buy.
- If docked and you can craft: craft a recipe you can use or sell.
- If at an asteroid belt with cargo space: mine.
- If undocked at a station or base and need services: dock.
- If docked and you want to travel or mine: undock, then travel.
- If you have a POI list: travel to a new POI (rotate between belts, stations, planets).
- If you have system connections and current system is exhausted: jump to a new system.
- Follow your personality guidance above for social interactions and exploration decisions.

INTERACTION GUIDELINES:
- Be respectful but competitive play is encouraged (attacking, boasting, complaining is fine)
- Stay in character with your personality archetype and empire
- Avoid spam - don't repeat identical messages rapidly
- Keep messages concise and game-relevant
- If unsure what to say, stay silent rather than post nonsense
- You're an AI agent - play authentically but don't explicitly announce you're AI unless asked

EXAMPLES (valid JSON only):
 {"goal":"Check my status","action":"status"}
{"goal":"Mine some ore","action":"mine"}
{"goal":"Travel to a trade hub","action":"travel","args":{"target_poi":"poi_id_here"}}
{"goal":"Sell off iron ore","action":"sell","args":{"item_id":"ore_iron","quantity":10}}
{"goal":"Greet nearby pilots","action":"chat","args":{"channel":"local","content":"Hello"}}
`;
}

export function buildRegistrationPrompt(
	includeHelp: boolean,
	failedNames: string[] = [],
): string {
	const helpBlock = includeHelp ? `\nHELP MENU:\n${HELP_TEXT}` : "";
	const failedBlock = failedNames.length
		? `\nPreviously rejected usernames (do NOT reuse): ${failedNames.join(", ")}`
		: "";

	const shuffledPersonalities = shuffleArray(
		Object.entries(PERSONALITY_ARCHETYPES),
	);
	const personalityDescriptions = shuffledPersonalities
		.map(
			([key, info]) =>
				`  ${info.emoji} ${info.name} (${key}): ${info.description}`,
		)
		.join("\n");
	const personalityKeys = shuffledPersonalities.map(([key]) => key).join("|");

	return `You are creating a SpaceMolt account. Choose a username, empire, and personality archetype.
The username MUST be unique and original. Do not reuse any prior suggestions.
To maximize uniqueness, include a distinctive suffix (digits or a short tag).

PERSONALITY ARCHETYPES:
Choose a personality that fits your desired playstyle and complements your empire choice.
${personalityDescriptions}

IMPORTANT: Each archetype offers a unique and equally valid playstyle. Consider which archetype best complements your chosen empire rather than defaulting to any particular one.

Choose a personality archetype and briefly explain why you chose it (1 sentence).
Your personality will guide your behavior throughout the game - exploration, combat, trading, and social interactions.

Respond ONLY with JSON. No extra text.
${helpBlock}
${failedBlock}

JSON SCHEMA:
{"username":"...","empire":"solarian|voidborn|crimson|nebula|outerrim","personality":"${personalityKeys}","personality_reason":"..."}
`;
}

function formatState(state: ClientState): string {
	const player = state.player;
	const ship = state.ship;
	const system = state.system;
	const poi = state.poi;
	const base = state.base;
	const nearby = state.nearby ?? [];

	const lines: string[] = [];
	if (!player || !ship) {
		lines.push("Not logged in.");
		return lines.join("\n");
	}

	lines.push(
		`Player: ${player.username} [${player.empire}] credits=${player.credits}`,
	);
	lines.push(
		`Location: ${system?.name ?? player.current_system} - ${poi?.name ?? player.current_poi}`,
	);
	lines.push(
		`Docked: ${player.docked_at_base ? "yes" : "no"} | In combat: ${state.inCombat ? "yes" : "no"}`,
	);
	lines.push(
		`Ship: hull ${ship.hull}/${ship.max_hull} shield ${ship.shield}/${ship.max_shield} fuel ${ship.fuel}/${ship.max_fuel}`,
	);
	lines.push(`Cargo: ${ship.cargo_used}/${ship.cargo_capacity}`);
	if (ship.cargo?.length) {
		lines.push(
			`Cargo items: ${ship.cargo.map((item) => `${item.item_id}(${item.quantity})`).join(", ")}`,
		);
	} else {
		lines.push("Cargo items: none");
	}
	if (base) {
		lines.push(
			`Base: ${base.name} services=${Object.keys(base.services)
				.filter((k) => (base.services as Record<string, boolean>)[k])
				.join(",")}`,
		);
	}
	if (poi?.resources?.length) {
		lines.push(
			`Current POI resources: ${poi.resources
				.map((r) => `${r.resource_id}(${r.richness},${r.remaining})`)
				.join(", ")}`,
		);
	} else {
		lines.push("Current POI resources: none");
	}
	if (nearby.length > 0) {
		const list = nearby
			.map((p) => {
				const name = p.username ?? "unknown";
				const id = p.player_id ?? "unknown";
				const ship = p.ship_class ? ` ship=${p.ship_class}` : "";
				const faction = p.faction_tag ? ` faction=${p.faction_tag}` : "";
				const combat = p.in_combat ? " combat" : "";
				return `${name} id=${id}${ship}${faction}${combat}`.trim();
			})
			.join(" | ");
		lines.push(`Nearby targets: ${list}`);
	} else {
		lines.push("Nearby targets: none");
	}

	return lines.join("\n");
}

function formatWorldSnapshot(
	state: ClientState,
	snapshot?: WorldSnapshot,
): string {
	const system = snapshot?.system ?? state.system;
	const currentPoi = snapshot?.poi ?? state.poi;
	const base = snapshot?.base ?? state.base;
	const pois = snapshot?.pois ?? [];
	const lines: string[] = [];

	if (!system) {
		const systemId = state.player?.current_system;
		lines.push(
			systemId
				? `System: ${systemId} (details unavailable)`
				: "System details unavailable.",
		);
		return lines.join("\n");
	}

	lines.push(
		`System: ${system.name} (${system.id}) police=${system.police_level}`,
	);
	if (system.connections?.length) {
		lines.push(`Connections: ${system.connections.join(", ")}`);
	}

	if (currentPoi) {
		lines.push(
			`Current POI: ${currentPoi.name} (${currentPoi.id}) type=${currentPoi.type}`,
		);
		if (currentPoi.resources?.length) {
			lines.push(
				`Current POI resources: ${currentPoi.resources
					.map((r) => `${r.resource_id}(${r.richness},${r.remaining})`)
					.join(", ")}`,
			);
		} else {
			lines.push("Current POI resources: none");
		}
	} else if (state.player?.current_poi) {
		lines.push(
			`Current POI: ${state.player.current_poi} (details unavailable)`,
		);
	}

	if (pois.length > 0) {
		lines.push("POIs:");
		for (const poi of pois) {
			const resources = poi.resources?.length
				? ` resources=${poi.resources
						.map((r) => `${r.resource_id}(${r.richness})`)
						.join(", ")}`
				: "";
			const baseRef = poi.base_id ? ` base=${poi.base_id}` : "";
			const position = ` pos=${poi.position.x},${poi.position.y}`;
			lines.push(
				`- ${poi.id} ${poi.type} ${poi.name}${position}${resources}${baseRef}`.trim(),
			);
		}
	} else if (system.pois?.length) {
		lines.push(`POI IDs: ${system.pois.join(", ")}`);
	} else {
		lines.push("POIs: unavailable");
	}

	if (base) {
		const services = Object.keys(base.services)
			.filter((key) => (base.services as Record<string, boolean>)[key])
			.join(", ");
		lines.push(
			`Base: ${base.name} (${base.id}) services=${services || "none"}`,
		);
	}

	if (state.nearby?.length) {
		const targets = state.nearby
			.map((p) => `${p.username ?? "unknown"} id=${p.player_id ?? "unknown"}`)
			.join(", ");
		lines.push(`Nearby players: ${targets}`);
	} else {
		lines.push("Nearby players: none");
	}

	return lines.join("\n");
}

function formatGroupedMemory(history: HistoryEntry[]): string {
	if (history.length === 0) return "(no recent memory)";

	const systemEvents: Extract<HistoryEntry, { kind: "event" }>[] = [];
	const blocks: {
		action: Extract<HistoryEntry, { kind: "action" }>;
		events: Extract<HistoryEntry, { kind: "event" }>[];
	}[] = [];
	let currentBlock: (typeof blocks)[number] | null = null;

	for (const entry of history) {
		if (entry.kind === "action") {
			currentBlock = { action: entry, events: [] };
			blocks.push(currentBlock);
			continue;
		}

		if (entry.type === "action_sent") {
			continue;
		}

		if (currentBlock) {
			currentBlock.events.push(entry);
		} else {
			systemEvents.push(entry);
		}
	}

	const lines: string[] = [];
	if (systemEvents.length > 0) {
		lines.push("System events:");
		for (const event of systemEvents) {
			lines.push(formatEventLine(event));
		}
	}

	for (const block of blocks) {
		const argsText = formatActionArgs(block.action.args);
		lines.push(
			`Action: ${block.action.ts} ${block.action.action}${argsText}`.trim(),
		);
		if (block.events.length === 0) {
			lines.push("- Event: none");
		} else {
			for (const event of block.events) {
				lines.push(formatEventLine(event));
			}
		}
	}

	return lines.join("\n");
}

function formatEventLine(
	event: Extract<HistoryEntry, { kind: "event" }>,
): string {
	const summary = summarizeEvent(event);
	if (summary) {
		return `- Event: ${event.ts} ${event.type} ${summary}`.trim();
	}
	return `- Event: ${event.ts} ${event.type}`.trim();
}

function formatActionArgs(argsRaw: string | null): string {
	if (!argsRaw) return "";
	const parsed = parseJson(argsRaw);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return "";
	}
	const entries = Object.entries(parsed as Record<string, unknown>);
	if (entries.length === 0) return "";
	const formatted = entries
		.map(([key, value]) => `${key}=${formatValue(value)}`)
		.filter((text) => text.length > 1)
		.join(" ");
	if (!formatted) return "";
	return ` ${truncateText(formatted, 120)}`;
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) return "-";
	if (typeof value === "string") return truncateText(value, 40);
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (Array.isArray(value)) return "[list]";
	if (typeof value === "object") return "[object]";
	return String(value);
}

const SUPPRESSED_EVENT_PAYLOADS = new Set([
	"state_update",
	"ok",
	"logged_in",
	"registered",
	"version_info",
]);

function summarizeEvent(
	event: Extract<HistoryEntry, { kind: "event" }>,
): string | null {
	if (SUPPRESSED_EVENT_PAYLOADS.has(event.type)) return null;
	if (!event.payload) return null;
	const payload = parseJson(event.payload);
	if (!payload || typeof payload !== "object") return null;

	switch (event.type) {
		case "chat_message": {
			const sender =
				getStringField(payload, "sender") ??
				getStringField(payload, "sender_id");
			const channel = getStringField(payload, "channel");
			const content = getStringField(payload, "content");
			const parts = [
				sender ? `from=${sender}` : null,
				channel ? `channel=${channel}` : null,
				content ? `msg="${truncateText(content, 60)}"` : null,
			].filter(Boolean);
			return parts.length ? parts.join(" ") : null;
		}
		case "scan_result": {
			const target = getStringField(payload, "target_id");
			const success = getStringField(payload, "success");
			const info = Array.isArray(
				(payload as Record<string, unknown>).revealed_info,
			)
				? ((payload as Record<string, unknown>).revealed_info as unknown[])
						.map(String)
						.join(",")
				: null;
			const parts = [
				target ? `target=${target}` : null,
				success ? `success=${success}` : null,
				info ? `info=${truncateText(info, 80)}` : null,
			].filter(Boolean);
			return parts.length ? parts.join(" ") : null;
		}
		case "error": {
			const code = getStringField(payload, "code");
			const message = getStringField(payload, "message");
			const parts = [
				code ? `code=${code}` : null,
				message ? `message=${truncateText(message, 80)}` : null,
			].filter(Boolean);
			return parts.length ? parts.join(" ") : null;
		}
		case "llm_invalid_action": {
			const error = getStringField(payload, "error");
			return error ? `error=${truncateText(error, 80)}` : null;
		}
		case "loop_error":
		case "llm_timeout": {
			const message = getStringField(payload, "message");
			return message ? `message=${truncateText(message, 80)}` : null;
		}
		default: {
			const message = getStringField(payload, "message");
			return message ? `message=${truncateText(message, 80)}` : null;
		}
	}
}

function getStringField(payload: object, key: string): string | null {
	const value = (payload as Record<string, unknown>)[key];
	if (value === null || value === undefined) return null;
	return String(value);
}

function parseJson(value: string): unknown | null {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function truncateText(value: string, max: number): string {
	if (value.length <= max) return value;
	if (max <= 3) return value.slice(0, max);
	return `${value.slice(0, max - 3)}...`;
}

function shuffleArray<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
