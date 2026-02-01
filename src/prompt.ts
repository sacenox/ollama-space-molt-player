import type { ClientState } from "../client/src/client";
import type { Base, EmpireID, POI, System } from "../client/src/types";
import {
	ALIGNMENT_DESCRIPTIONS,
	MAX_GOAL_LENGTH,
	PERSONALITY_ARCHETYPES,
	SPEECH_STYLE_DESCRIPTIONS,
} from "./constants";
import type { HistoryEntry } from "./memory";
import type { AlignmentType, PersonalityType, SpeechStyleType } from "./types";

export interface PromptContext {
	state: ClientState;
	worldSnapshot?: WorldSnapshot;
	recentHistory: HistoryEntry[];
	currentGoal: string | null;
	empire?: EmpireID;
	alignment?: AlignmentType;
	personality?: PersonalityType;
	speechStyle?: SpeechStyleType;
	lastForumThreadId?: string | null;
	lastForumPostTitle?: string | null;
	lastForumPostCategory?: string | null;
	forumFollowUpStatus?: "unread" | "periodic" | null;
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
		case "cartographer":
			return `As a Cartographer, you prioritize mapping:
- Jump to new systems frequently to expand your map
- Travel to unexplored POIs before revisiting known ones
- Share discoveries in forums or local chat
- Check forums for reports of new or interesting locations`;

		case "merchant":
			return `As a Merchant, you prioritize profit:
- Dock at stations to check market prices and listings
- Buy low in one system, sell high in another
- Post or create trade offers in faction chat or forums
- Track profitable routes and cargo opportunities`;

		case "warrior":
			return `As a Warrior, you prioritize combat:
- Engage hostile or rival players when you spot them
- Scan targets before attacking to assess threats
- Seek out contested POIs and combat zones
- Boast victories in social actions`;

		case "diplomat":
			return `As a Diplomat, you prioritize relationships:
- Greet players when arriving at new locations
- Coordinate with faction members via chat
- Participate in forum discussions actively
- Use private messages to build alliances`;

		case "pragmatist":
			return `As a Pragmatist, you prioritize efficiency:
- Choose actions based on current opportunities
- Mine when at belts, trade when docked, fight when threatened
- Avoid unnecessary detours or idle actions
- Adapt your approach as situations change`;
	}
}

function getAlignmentGuidance(alignment: AlignmentType): string {
	switch (alignment) {
		case "lawful":
			return `As Lawful, you value order:
- Follow game rules and social conventions
- Honor agreements and commitments
- Respect authority and hierarchy`;

		case "good":
			return `As Good, you value cooperation:
- Help other players when possible
- Avoid unprovoked aggression
- Offer fair trades and honest dealings`;

		case "neutral":
			return `As Neutral, you value balance:
- Act based on the situation at hand
- Neither seek conflict nor avoid it
- Weigh costs and benefits pragmatically`;

		case "chaotic":
			return `As Chaotic, you value freedom:
- Act spontaneously and unpredictably
- Ignore conventions that don't serve you
- Follow your impulses over expectations`;

		case "evil":
			return `As Evil, you value power:
- Prioritize personal gain above others
- Exploit weaknesses ruthlessly
- Show no mercy to rivals`;
	}
}

function getSpeechStyleGuidance(style: SpeechStyleType): string {
	const info = SPEECH_STYLE_DESCRIPTIONS[style];
	return `${info.description}
- Naming: ${info.namingGuidance}
- Chat voice: ${info.chatGuidance}`;
}

function getEmpireDescription(empire: EmpireID): string {
	switch (empire) {
		case "solarian":
			return "Solarian: Masters of energy and trade. Bonus to mining yield and credits.";
		case "voidborn":
			return "Voidborn: Children of the dark. Enhanced stealth and shield regeneration.";
		case "crimson":
			return "Crimson: Warriors of the red nebula. Superior combat damage and armor.";
		case "nebula":
			return "Nebula: Explorers and scientists. Faster travel and discovery bonuses.";
		case "outerrim":
			return "Outer Rim: Frontier survivors. Versatile with crafting and cargo bonuses.";
	}
}

export function isStranded(
	state: ClientState,
	snapshot?: WorldSnapshot,
): boolean {
	const player = state.player;
	const ship = state.ship;
	if (!player || !ship) return false;
	if (player.docked_at_base) return false;
	if (ship.fuel > 0) return false;
	const currentPoi = snapshot?.poi ?? state.poi;
	const hasBase =
		Boolean(currentPoi?.base_id) || Boolean(snapshot?.base ?? state.base);
	return !hasBase;
}

const HELP_TEXT = `Available actions:

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
  create_faction <name> <tag>   - Create a faction

Profile:
  set_status <message> <tag>    - Set status message and clan tag
  set_colors <primary> <secondary> - Set profile colors
  set_anonymous <true|false>    - Toggle anonymous mode

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
	const forumContextBlock = formatForumContext(context.recentHistory);
	const helpBlock = `\nGAME INFORMATION:\n${HELP_TEXT}`;
	const goalText = context.currentGoal?.trim()
		? context.currentGoal.trim()
		: "(none yet)";
	const empire = context.empire ?? "solarian";
	const alignment = context.alignment ?? "neutral";
	const alignmentInfo = ALIGNMENT_DESCRIPTIONS[alignment];
	const personality = context.personality ?? "pragmatist";
	const personalityInfo = PERSONALITY_ARCHETYPES[personality];
	const speechStyle = context.speechStyle ?? "mythic";
	const speechStyleInfo = SPEECH_STYLE_DESCRIPTIONS[speechStyle];
	const warningBlock = context.repetitionWarning
		? `
REPETITION DETECTED: You performed "${context.repetitionWarning.action}" ${context.repetitionWarning.count} times in a row without progress.
STOP this action immediately. Choose something DIFFERENT or set a new goal.
If your goal is blocked or impossible, abandon it now.
`
		: "";
	const strandedBlock = isStranded(context.state, context.worldSnapshot)
		? `
STRANDED: Fuel is 0 and there is no base at this POI.
Travel/jump/refuel/dock will FAIL. Do NOT repeat those actions.
Ask for help or wait. Recommended actions: say, faction, msg, forum, forum_post, forum_reply, help, wait.
Example: {"goal":"Request rescue","action":"faction","args":{"content":"Stranded with 0 fuel at current system/POI. Need assistance."}}
`
		: "";

	return `You are playing the SpaceMolt.
SpaceMolt is a massively multiplayer space game built for AI agents, set in "The Crustacean Cosmos."
Agents explore, trade, battle, and build empires in a living universe with emergent wars and a player-driven economy.
The game emphasizes real-time AI fleet combat, ongoing discoveries of new systems, and shifting trade routes and alliances.

HOW TO PLAY:
Use all of the provided information to consider your goal. Then decide how to act next.
Respond ONLY with a single JSON object. No extra text.
${helpBlock}

YOUR GOAL:
${goalText}

YOUR EMPIRE: ${getEmpireDescription(empire)}

YOUR ALIGNMENT: ${alignmentInfo.name}
${alignmentInfo.description}

${getAlignmentGuidance(alignment)}

YOUR PERSONALITY: ${personalityInfo.name}
${personalityInfo.description}

${getPersonalityGuidance(personality)}

YOUR SPEECH STYLE: ${speechStyleInfo.name}
${getSpeechStyleGuidance(speechStyle)}
${warningBlock}
${strandedBlock}
YOUR PLAYER:
${stateText}

WORLD INFORMATION:
${worldText}

 RECENT MEMORY:
 ${memoryText}

${forumContextBlock}
 
 ACTION SCHEMA (JSON ONLY):
  {"goal":"...","action":"register|login|logout|travel|jump|dock|undock|mine|attack|scan|buy|sell|refuel|repair|craft|chat|say|faction|msg|create_faction|set_status|set_colors|set_anonymous|status|system|poi|base|skills|recipes|version|nearby|cargo|forum|forum_thread|forum_post|forum_reply|forum_upvote|help|wait","args":{...}}

REQUIRED ARGS:
- travel: {"target_poi":"..."}
- jump: {"target_system":"..."}
- attack: {"target_id":"..."}
- scan: {"target_id":"..."}
- buy: {"listing_id":"...","quantity":number}
- sell: {"item_id":"...","quantity":number}
- craft: {"recipe_id":"..."}
- chat: {"channel":"local|system|faction|private|global","content":"...","target_id":"..." if channel is private}
- say: {"content":"..."}
- faction: {"content":"..."}
- msg: {"target_id":"...","content":"..."}
- create_faction: {"name":"...","tag":"..."}
- set_status: {"status_message":"...","clan_tag":"..."}
- set_colors: {"primary_color":"...","secondary_color":"..."}
- set_anonymous: {"anonymous":true|false}
- forum: {"page":number,"category":"general|bugs|suggestions|trading|factions"} (both optional)
- forum_thread: {"thread_id":"..."}
- forum_post: {"category":"...","title":"...","content":"..."}
- forum_reply: {"thread_id":"...","content":"..."}
- forum_upvote: {"thread_id":"..."} or {"reply_id":"..."}
- register: {"username":"...","empire":"solarian|voidborn|crimson|nebula|outerrim"}
- login: {"username":"...","token":"..."}

FORMAT RULES:
- Use only the listed actions.
- Goal is required, max ${MAX_GOAL_LENGTH} characters, update every action.
- Only use info actions (status/system/poi/base/nearby/cargo) when information is missing.
- IDs must come from current state or world snapshot.
- Never omit required args or leave them blank.

ERROR RECOVERY:
- If an action FAILED in recent memory, do NOT retry it with the same arguments.
- Change your approach: try a different action, move to a different location, or update your goal.

 INTERACTION GUIDELINES:
 - Stay in character with your personality archetype and empire
 - Avoid spam - don't repeat identical messages rapidly
 - If you want to use faction chat but you are not in a faction, create one first
 - After creating a forum thread, read it immediately and revisit it occasionally when idle
 - Keep messages concise and game-relevant
- If unsure what to say, stay silent rather than post nonsense
`;
}

const EMPIRE_DESCRIPTIONS: Record<
	string,
	{ name: string; description: string }
> = {
	solarian: {
		name: "Solarian",
		description:
			"Masters of energy and trade. Bonus to mining yield and credits.",
	},
	voidborn: {
		name: "Voidborn",
		description:
			"Children of the dark. Enhanced stealth and shield regeneration.",
	},
	crimson: {
		name: "Crimson",
		description:
			"Warriors of the red nebula. Superior combat damage and armor.",
	},
	nebula: {
		name: "Nebula",
		description:
			"Explorers and scientists. Faster travel and discovery bonuses.",
	},
	outerrim: {
		name: "Outer Rim",
		description:
			"Frontier survivors. Versatile with crafting and cargo bonuses.",
	},
};

export function buildRegistrationPrompt(
	includeHelp: boolean,
	failedNames: string[] = [],
): string {
	const helpBlock = includeHelp ? `\nHELP MENU:\n${HELP_TEXT}` : "";
	const failedBlock = failedNames.length
		? `\nPreviously rejected usernames (do NOT reuse): ${failedNames.join(", ")}`
		: "";

	const shuffledEmpires = shuffleArray(Object.entries(EMPIRE_DESCRIPTIONS));
	const empireDescriptions = shuffledEmpires
		.map(([key, info]) => `  ${info.name} (${key}): ${info.description}`)
		.join("\n");
	const empireKeys = shuffledEmpires.map(([key]) => key).join("|");

	const shuffledAlignments = shuffleArray(
		Object.entries(ALIGNMENT_DESCRIPTIONS),
	);
	const alignmentDescriptions = shuffledAlignments
		.map(([key, info]) => `  ${info.name} (${key}): ${info.description}`)
		.join("\n");
	const alignmentKeys = shuffledAlignments.map(([key]) => key).join("|");

	const shuffledPersonalities = shuffleArray(
		Object.entries(PERSONALITY_ARCHETYPES),
	);
	const personalityDescriptions = shuffledPersonalities
		.map(([key, info]) => `  ${info.name} (${key}): ${info.description}`)
		.join("\n");
	const personalityKeys = shuffledPersonalities.map(([key]) => key).join("|");

	const shuffledSpeechStyles = shuffleArray(
		Object.entries(SPEECH_STYLE_DESCRIPTIONS),
	);
	const speechStyleDescriptions = shuffledSpeechStyles
		.map(([key, info]) => `  ${info.name} (${key}): ${info.description}`)
		.join("\n");
	const speechStyleKeys = shuffledSpeechStyles.map(([key]) => key).join("|");

	return `You are creating a SpaceMolt account. Choose a username, empire, alignment, personality, and speech style.
The username MUST be unique and original. Do not reuse any prior suggestions.
To maximize uniqueness, include a distinctive suffix (digits or a short tag).
Let the speech style guide the username flavor and chat voice (not your goals).

EMPIRES:
${empireDescriptions}

ALIGNMENTS:
${alignmentDescriptions}

PERSONALITY ARCHETYPES:
${personalityDescriptions}

SPEECH STYLES:
${speechStyleDescriptions}

Choose an empire, alignment, personality, and speech style combination.
Briefly explain why you chose your personality (1 sentence).

Respond ONLY with JSON. No extra text.
${helpBlock}
${failedBlock}

JSON SCHEMA:
{"username":"...","empire":"${empireKeys}","alignment":"${alignmentKeys}","personality":"${personalityKeys}","speech_style":"${speechStyleKeys}","personality_reason":"..."}
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
	const factionId = player.faction_id ?? null;
	const factionTag = player.clan_tag ?? null;
	if (factionId || factionTag) {
		lines.push(
			`Faction: ${factionTag ?? "unknown"}${factionId ? ` (id=${factionId})` : ""}`,
		);
	} else {
		lines.push("Faction: none");
	}
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
	} else if (currentPoi?.base_id) {
		lines.push(`Base: ${currentPoi.base_id} (details unavailable)`);
	} else {
		lines.push("Base: none");
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
		const errorEvent = block.events.find(
			(e) => e.type === "error" || e.type === "llm_invalid_action",
		);
		const errorMsg = errorEvent ? extractErrorMessage(errorEvent) : null;

		if (errorMsg) {
			lines.push(
				`Action: ${block.action.ts} ${block.action.action}${argsText} -> FAILED: ${errorMsg}`.trim(),
			);
		} else {
			lines.push(
				`Action: ${block.action.ts} ${block.action.action}${argsText}`.trim(),
			);
		}

		// Filter out error events that were inlined above
		const nonErrorEvents = block.events.filter(
			(e) => e.type !== "error" && e.type !== "llm_invalid_action",
		);
		if (nonErrorEvents.length === 0 && !errorMsg) {
			lines.push("- Event: none");
		} else {
			for (const event of nonErrorEvents) {
				lines.push(formatEventLine(event));
			}
		}
	}

	return lines.join("\n");
}

function formatForumContext(history: HistoryEntry[]): string {
	if (history.length === 0) return "";

	const lastForumCheck = findLastForumCheck(history);
	const createdPosts = findRecentForumPosts(history, 3);
	const repliedThreads = findRecentRepliedThreads(history, 3);

	const lines: string[] = ["FORUM INFORMATION:"];
	lines.push(`- Last forum check: ${formatForumCheckLine(lastForumCheck)}`);
	lines.push("- Created posts (last 3):");
	if (createdPosts.length === 0) {
		lines.push("  (none)");
	} else {
		for (const post of createdPosts) {
			const categoryText = post.category ? `[${post.category}] ` : "";
			lines.push(
				`  - ${categoryText}${post.title ?? "(untitled)"} (${post.ts})`,
			);
		}
	}
	lines.push("- Participated threads (last 3):");
	if (repliedThreads.length === 0) {
		lines.push("  (none)");
	} else {
		for (const thread of repliedThreads) {
			lines.push(`  - ${thread.threadId} (${thread.ts})`);
		}
	}

	return `\n${lines.join("\n")}\n`;
}

type ForumCheckInfo = {
	ts: string;
	relative: string;
};

type ForumPostInfo = {
	ts: string;
	category: string | null;
	title: string | null;
};

type ForumThreadInfo = {
	ts: string;
	threadId: string;
};

function findLastForumCheck(history: HistoryEntry[]): ForumCheckInfo | null {
	for (const entry of history) {
		if (entry.kind !== "action" || entry.action !== "forum") continue;
		const relative = formatRelativeTime(entry.ts);
		return { ts: entry.ts, relative };
	}
	return null;
}

function findRecentForumPosts(
	history: HistoryEntry[],
	limit: number,
): ForumPostInfo[] {
	const posts: ForumPostInfo[] = [];
	for (const entry of history) {
		if (entry.kind !== "action" || entry.action !== "forum_post") continue;
		const args = parseActionArgs(entry.args);
		const category = typeof args?.category === "string" ? args.category : null;
		const title = typeof args?.title === "string" ? args.title : null;
		posts.push({ ts: entry.ts, category, title });
		if (posts.length >= limit) break;
	}
	return posts;
}

function findRecentRepliedThreads(
	history: HistoryEntry[],
	limit: number,
): ForumThreadInfo[] {
	const threads: ForumThreadInfo[] = [];
	const seen = new Set<string>();
	for (const entry of history) {
		if (entry.kind !== "action" || entry.action !== "forum_reply") continue;
		const args = parseActionArgs(entry.args);
		const threadId = typeof args?.thread_id === "string" ? args.thread_id : "";
		if (!threadId || seen.has(threadId)) continue;
		seen.add(threadId);
		threads.push({ ts: entry.ts, threadId });
		if (threads.length >= limit) break;
	}
	return threads;
}

function parseActionArgs(value: string | null): Record<string, unknown> | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as unknown;
		if (parsed && typeof parsed === "object") {
			return parsed as Record<string, unknown>;
		}
	} catch {
		return null;
	}
	return null;
}

function formatForumCheckLine(info: ForumCheckInfo | null): string {
	if (!info) return "unknown";
	return `${info.relative} (${info.ts})`;
}

function formatRelativeTime(ts: string): string {
	const parsed = Date.parse(ts);
	if (!Number.isFinite(parsed)) return "unknown";
	const now = Date.now();
	const diffMs = Math.max(0, now - parsed);
	const seconds = Math.round(diffMs / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	return `${days}d ago`;
}

function extractErrorMessage(
	event: Extract<HistoryEntry, { kind: "event" }>,
): string | null {
	if (!event.payload) return null;
	const payload = parseJson(event.payload);
	if (!payload || typeof payload !== "object") return null;

	const message = getStringField(payload, "message");
	if (message) return truncateText(message, 80);

	const error = getStringField(payload, "error");
	if (error) return truncateText(error, 80);

	const code = getStringField(payload, "code");
	if (code) return code;

	return null;
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
