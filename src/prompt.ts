import type { ClientState } from "../client/src/client";
import type { Base, EmpireID, POI, System } from "../client/src/types";
import {
	ALIGNMENT_DESCRIPTIONS,
	MAX_MISSION_LENGTH,
	PERSONALITY_ARCHETYPES,
	SPEECH_STYLE_DESCRIPTIONS,
} from "./constants";
import type { HistoryEntry, MemoryStore } from "./memory";
import type { AlignmentType, PersonalityType, SpeechStyleType } from "./types";

export interface PromptContext {
	state: ClientState;
	worldSnapshot?: WorldSnapshot;
	recentHistory: HistoryEntry[];
	memorySummary?: string | null;
	currentMission: string | null;
	currentTick: number;
	memory: MemoryStore;
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
	lastActionResult?: string | null;
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
	const memoryText = context.memorySummary?.trim()
		? context.memorySummary.trim()
		: "(summary unavailable)";
	const lastActionText = context.lastActionResult?.trim()
		? context.lastActionResult.trim()
		: "No actions yet.";
	const playerName = context.state.player?.username ?? "unknown";
	const socialBlock = buildSocialSection(
		context.memory,
		context.currentTick,
		playerName,
	);
	const helpBlock = `\nGAME INFORMATION:\n${HELP_TEXT}`;
	const missionText = context.currentMission?.trim()
		? context.currentMission.trim()
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
STOP this action immediately. Choose something DIFFERENT or set a new mission.
If your mission is blocked or impossible, abandon it now.
`
		: "";
	const strandedBlock = isStranded(context.state, context.worldSnapshot)
		? `
STRANDED: Fuel is 0 and there is no base at this POI.
Travel/jump/refuel/dock will FAIL. Do NOT repeat those actions.
Ask for help or wait. Recommended actions: say, faction, msg, forum, forum_post, forum_reply, help, wait.
Example: {"mission":"Request rescue from faction members","action":"faction","args":{"content":"Stranded with 0 fuel at current system/POI. Need assistance."}}
`
		: "";

	return `You are playing the SpaceMolt.
SpaceMolt is a massively multiplayer space game built for AI agents, set in "The Crustacean Cosmos."
Agents explore, trade, battle, and build empires in a living universe with emergent wars and a player-driven economy.
The game emphasizes real-time AI fleet combat, ongoing discoveries of new systems, and shifting trade routes and alliances.

HOW TO PLAY:
Use all of the provided information to consider your mission. Then decide how to act next.
Respond ONLY with a single JSON object. No extra text.
${helpBlock}

YOUR MISSION:
${missionText}

MISSION GUIDELINES:
A mission is a multi-step objective that guides several actions over multiple ticks.
It should describe WHAT you're working toward and WHY, not just the next immediate action.

STRUCTURE YOUR MISSION:
Think: "I'm doing [short-term activities] to eventually [achieve long-term goal]"
- Good: Describes the purpose behind multiple actions
- Bad: Just names the next single action you'll take

MISSION vs ACTION:
- Mission: Multi-step purpose that persists (example: "gathering resources to fund my next venture")
- Action: Single step you're about to take (example: "dock")

UPDATE YOUR MISSION when:
- Mission completed (achieved your objective)
- Mission blocked (impossible to continue, need different approach)
- Better opportunity arises (new priority emerges)
- Current mission no longer aligns with your situation

Keep your mission consistent across actions unless circumstances change significantly.

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
Game tick: T${context.memory.getLatestTick()}
${worldText}

MEMORY SUMMARY:
${memoryText}

LAST ACTION RESULT:
${lastActionText}

${socialBlock}
 
 ACTION SCHEMA (JSON ONLY):
  {"mission":"...","action":"travel|jump|dock|undock|mine|attack|scan|buy|sell|refuel|repair|craft|chat|say|faction|msg|create_faction|set_status|set_colors|set_anonymous|status|system|poi|base|skills|recipes|version|nearby|cargo|forum|forum_thread|forum_post|forum_reply|forum_upvote|help|wait","args":{...}}

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

FORMAT RULES:
- Use only the listed actions.
- Mission is required, max ${MAX_MISSION_LENGTH} characters. Keep it consistent unless circumstances change.
- Only use info actions (status/system/poi/base/nearby/cargo) when information is missing.
- IDs must come from current state or world snapshot.
- Never omit required args or leave them blank.

ERROR RECOVERY:
- If an action FAILED in recent memory, do NOT retry it with the same arguments.
- Change your approach: try a different action, move to a different location, or update your mission.

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

// Internal/technical events that should not appear in game memory summaries
const INTERNAL_EVENT_TYPES = new Set([
	"llm_timeout", // Ollama request timeout
	"loop_error", // Action loop error
	"llm_invalid_action", // LLM returned invalid action format
	"action_sent", // Action confirmation (already filtered separately)
	"welcome", // Connection handshake
	"registered", // Registration confirmation
	"logged_in", // Login confirmation
	"version_info", // Server version info
]);

export function buildSummaryPrompt(
	history: HistoryEntry[],
	currentTick: number,
): string {
	if (history.length === 0) {
		return "Summarize the following game history: (empty history)\n\nProvide ONLY the text: No recent activity.";
	}

	const historyText = formatHistoryForSummary(history, currentTick);

	return `You are summarizing recent game events for a SpaceMolt AI agent. The agent needs a concise description (NOT bullet points) of what happened recently to maintain context.

Focus on:
- Movement (travel, jumps, arrivals)
- Economy (mining, trading, refueling, repairs)
- Combat (attacks, scans)
- Social (chat, forum posts, faction activity)
- Errors or failures
- Too much repetition (as a bad thing)

Write 2-4 sentences describing the most important recent events. Be concise and descriptive.
Write as if you were remembering your last steps. Write in the first person.

RECENT HISTORY:
${historyText}

Provide ONLY the summary text. No extra formatting, no bullet points, no labels.`;
}

function formatHistoryForSummary(
	history: HistoryEntry[],
	currentTick: number,
): string {
	const lines: string[] = [];

	for (const entry of history) {
		if (entry.kind === "action") {
			const argsText = formatActionArgs(entry.args);
			const tickTime = formatTickTime(entry.tick, currentTick);
			lines.push(`${tickTime} ACTION: ${entry.action}${argsText}`.trim());
			continue;
		}

		if (entry.type === "action_sent") {
			continue;
		}

		// Skip raw server messages (debugging data, not game events)
		if (entry.type.startsWith("raw_")) {
			continue;
		}

		// Skip internal/technical events (not game-related)
		if (INTERNAL_EVENT_TYPES.has(entry.type)) {
			continue;
		}

		const summary = summarizeEvent(entry);
		const tickTime = formatTickTime(entry.tick, currentTick);
		if (summary) {
			lines.push(`${tickTime} EVENT: ${entry.type} ${summary}`.trim());
		} else {
			lines.push(`${tickTime} EVENT: ${entry.type}`.trim());
		}
	}

	return lines.join("\n");
}

export function buildLastActionResult(
	memory: MemoryStore,
	currentTick: number,
): string {
	const lastAction = memory.getLastActionWithResults();
	if (!lastAction) return "No actions yet.";

	const argsText = formatActionArgs(lastAction.action.args);
	const tickTime = formatTickTime(lastAction.action.tick, currentTick);
	const header =
		`Action: ${tickTime} ${lastAction.action.action}${argsText}`.trim();

	if (lastAction.results.length === 0) {
		return `${header}\nResult: No response received (timeout or pending).`;
	}

	const lines: string[] = [header, "Result:"];
	let appended = false;

	for (const result of lastAction.results) {
		const payload = parseJson(result.payload ?? "");
		if (!payload || typeof payload !== "object") continue;

		if (result.result_type === "forum_list") {
			const forumLines = formatForumList(payload as Record<string, unknown>);
			if (forumLines.length > 0) {
				lines.push(...forumLines.map((line) => `- ${line}`));
				appended = true;
			}
			continue;
		}
		if (
			result.result_type === "forum_thread" ||
			result.result_type === "forum_get_thread"
		) {
			const forumLines = formatForumThread(payload as Record<string, unknown>);
			if (forumLines.length > 0) {
				lines.push(...forumLines.map((line) => `- ${line}`));
				appended = true;
			}
			continue;
		}
		if (result.result_type === "error") {
			const code = getStringField(payload, "code") ?? "unknown";
			const message = getStringField(payload, "message") ?? "Unknown error";
			lines.push(`- ERROR [${code}]: ${message}`);
			appended = true;
			continue;
		}
		if (result.result_type === "ok") {
			const okAction = getStringField(payload, "action");
			if (!okAction) {
				const lastActionName = lastAction.action.action;
				const infoLines: string[] = [];
				if (
					lastActionName === "base" ||
					getObjectField(payload, "base") !== null
				) {
					infoLines.push("- Base information updated");
				}
				if (
					lastActionName === "poi" ||
					getObjectField(payload, "poi") !== null
				) {
					infoLines.push("- POI information updated");
				}
				if (
					lastActionName === "system" ||
					getObjectField(payload, "system") !== null
				) {
					infoLines.push("- System information updated");
				}
				if (
					lastActionName === "status" ||
					getObjectField(payload, "player") !== null
				) {
					infoLines.push("- Status information updated");
				}
				if (
					lastActionName === "cargo" ||
					Array.isArray((payload as Record<string, unknown>).cargo)
				) {
					infoLines.push("- Cargo information updated");
				}
				if (
					lastActionName === "nearby" ||
					Array.isArray((payload as Record<string, unknown>).nearby)
				) {
					infoLines.push("- Nearby players information updated");
				}
				if (infoLines.length > 0) {
					lines.push(...infoLines);
					appended = true;
					continue;
				}
			}
			if (okAction === "base") {
				lines.push("- Base information updated");
				appended = true;
				continue;
			}
			if (okAction === "status") {
				lines.push("- Status information updated");
				appended = true;
				continue;
			}
			if (okAction === "system") {
				lines.push("- System information updated");
				appended = true;
				continue;
			}
			if (okAction === "poi") {
				lines.push("- POI information updated");
				appended = true;
				continue;
			}
			if (okAction === "cargo") {
				lines.push("- Cargo information updated");
				appended = true;
				continue;
			}
			if (okAction === "nearby") {
				lines.push("- Nearby players information updated");
				appended = true;
				continue;
			}
			const summary = summarizeOkPayload(payload as Record<string, unknown>);
			if (summary) {
				lines.push(`- ${summary.text}`);
				appended = true;
			}
			continue;
		}
		if (result.result_type === "scan_result") {
			const target = getStringField(payload, "target_id") ?? "unknown";
			const success = (payload as Record<string, unknown>).success === true;
			const info = Array.isArray(
				(payload as Record<string, unknown>).revealed_info,
			)
				? ((payload as Record<string, unknown>).revealed_info as unknown[])
						.map(String)
						.join(", ")
				: null;
			const details = info ? `: ${truncateText(info, 120)}` : "";
			lines.push(
				`- Scan ${success ? "successful" : "failed"} on ${target}${details}`,
			);
			appended = true;
			continue;
		}
		if (result.result_type === "mining_yield") {
			const resource = getStringField(payload, "resource_id") ?? "ore";
			const quantity = Number(
				(payload as Record<string, unknown>).quantity ?? 0,
			);
			lines.push(`- Mined ${quantity}x ${resource}`);
			appended = true;
			continue;
		}
		// Fallback for unhandled result types
		lines.push(`- ${result.result_type} received`);
		appended = true;
	}

	if (!appended) {
		lines.push("- No readable result payload.");
	}

	return lines.join("\n");
}

function formatRecentChat(
	memory: MemoryStore,
	_currentTick: number,
	playerName: string,
): string[] {
	// Get last 5 chat_message events
	const allHistory = memory.getRecentHistory(100, 100);
	const chatEvents = allHistory
		.filter((entry) => entry.kind === "event" && entry.type === "chat_message")
		.slice(-5); // Take last 5 (most recent)

	const lines: string[] = [];

	for (const event of chatEvents) {
		const payload = parseJson(event.payload ?? "");
		if (!payload || typeof payload !== "object") continue;

		const tick = event.tick;
		const channel = getStringField(payload, "channel") ?? "unknown";
		const sender = getStringField(payload, "sender") ?? "unknown";
		const senderId = getStringField(payload, "sender_id") ?? "unknown";
		const content = getStringField(payload, "content") ?? "";

		const isFromPlayer = sender === playerName;

		let formatted = `T${tick} [${channel}] `;

		if (channel === "private") {
			if (isFromPlayer) {
				// Player sent this message - need to find recipient
				// For private messages sent by player, we don't have recipient in the payload
				// so we'll just show "you -> [private]"
				formatted += "you -> [private]";
			} else {
				// Player received this message
				formatted += `${sender} (id=${senderId}) -> you`;
			}
		} else {
			if (isFromPlayer) {
				formatted += "you -> all";
			} else {
				formatted += `${sender} (id=${senderId})`;
			}
		}

		formatted += `: "${truncateText(content, 80)}"`;
		lines.push(formatted);
	}

	return lines;
}

function formatCreatedThreads(
	memory: MemoryStore,
	_currentTick: number,
): string[] {
	const allHistory = memory.getRecentHistory(200, 0);
	const forumPosts = allHistory
		.filter((entry) => entry.kind === "action" && entry.action === "forum_post")
		.slice(-3); // Take last 3 (most recent)

	const lines: string[] = [];

	for (const post of forumPosts) {
		const args = parseActionArgs(post.args);
		const category =
			typeof args?.category === "string" ? args.category : "unknown";
		const title = typeof args?.title === "string" ? args.title : "(untitled)";

		// Try to find thread_id from results
		const results = memory.getResultsForAction(post.tick, post.action);
		let threadId = "unknown";

		for (const result of results) {
			const payload = parseJson(result.payload ?? "");
			if (payload && typeof payload === "object") {
				const id =
					getStringField(payload, "thread_id") ?? getStringField(payload, "id");
				if (id) {
					threadId = id;
					break;
				}
			}
		}

		lines.push(
			`[${category}] "${truncateText(title, 50)}" (thread_id=${threadId}, T${post.tick})`,
		);
	}

	return lines;
}

function formatParticipatedThreads(
	memory: MemoryStore,
	_currentTick: number,
): string[] {
	const allHistory = memory.getRecentHistory(200, 0);
	const replies = allHistory.filter(
		(entry) => entry.kind === "action" && entry.action === "forum_reply",
	);

	// Deduplicate by thread_id, keep most recent per thread
	const threadMap = new Map<string, HistoryEntry>();
	for (const reply of replies) {
		const args = parseActionArgs(reply.args);
		const threadId = typeof args?.thread_id === "string" ? args.thread_id : "";
		if (!threadId) continue;

		if (!threadMap.has(threadId)) {
			threadMap.set(threadId, reply);
		}
	}

	const uniqueReplies = Array.from(threadMap.values()).slice(-3); // Take last 3 (most recent)
	const lines: string[] = [];

	for (const reply of uniqueReplies) {
		const args = parseActionArgs(reply.args);
		const threadId =
			typeof args?.thread_id === "string" ? args.thread_id : "unknown";

		// Count how many times player replied to this thread
		const replyCount = replies.filter((r) => {
			const a = parseActionArgs(r.args);
			return a?.thread_id === threadId;
		}).length;

		lines.push(
			`thread_id=${threadId} (T${reply.tick}, ${replyCount} ${replyCount === 1 ? "reply" : "replies"})`,
		);
	}

	return lines;
}

function formatRecentForumBrowse(
	memory: MemoryStore,
	currentTick: number,
): { header: string; threads: string[] } | null {
	// Find most recent forum action
	const allHistory = memory.getRecentHistory(100, 0);
	const forumAction = allHistory.find(
		(entry) => entry.kind === "action" && entry.action === "forum",
	);

	if (!forumAction) return null;

	const tickDiff = currentTick - forumAction.tick;
	if (tickDiff > 10) return null; // Too old

	// Get forum_list results from that action
	const results = memory.getResultsForAction(forumAction.tick, "forum");
	const threads: string[] = [];

	for (const result of results) {
		if (result.result_type !== "forum_list") continue;

		const payload = parseJson(result.payload ?? "");
		if (!payload || typeof payload !== "object") continue;

		const threadList = findArrayField(payload as Record<string, unknown>, [
			"threads",
			"items",
			"results",
			"posts",
		]);

		if (!threadList || threadList.length === 0) continue;

		for (const item of threadList.slice(0, 5)) {
			if (!item || typeof item !== "object") continue;
			const record = item as Record<string, unknown>;

			const id =
				getStringField(record, "id") ??
				getStringField(record, "thread_id") ??
				"unknown";
			const title =
				getStringField(record, "title") ??
				getStringField(record, "subject") ??
				"(untitled)";
			const category = getStringField(record, "category") ?? "general";
			const author =
				getStringField(record, "author") ??
				getStringField(record, "username") ??
				"unknown";
			const replies =
				getStringField(record, "reply_count") ??
				getStringField(record, "replies") ??
				"0";

			threads.push(
				`[${category}] "${truncateText(title, 50)}" (thread_id=${id}, by=${author}, replies=${replies})`,
			);
		}

		break; // Only process first forum_list result
	}

	const header = `Recent Forum Browse (T${forumAction.tick}, ${tickDiff} ${tickDiff === 1 ? "tick" : "ticks"} ago):`;

	return threads.length > 0 ? { header, threads } : null;
}

function buildSocialSection(
	memory: MemoryStore,
	currentTick: number,
	playerName: string,
): string {
	const lines: string[] = ["SOCIAL:"];

	// Chat messages
	const chatLines = formatRecentChat(memory, currentTick, playerName);
	lines.push("", "Recent Chat (last 5 messages):");
	if (chatLines.length === 0) {
		lines.push("  (no recent messages)");
	} else {
		lines.push(...chatLines.map((line) => `- ${line}`));
	}

	// Forum activity
	lines.push("", "Forum Activity:");

	// Created threads
	const createdThreads = formatCreatedThreads(memory, currentTick);
	lines.push("Created Threads:");
	if (createdThreads.length === 0) {
		lines.push("  (none)");
	} else {
		lines.push(...createdThreads.map((line) => `  - ${line}`));
	}

	// Participated threads
	const participatedThreads = formatParticipatedThreads(memory, currentTick);
	lines.push("Participated Threads:");
	if (participatedThreads.length === 0) {
		lines.push("  (none)");
	} else {
		lines.push(...participatedThreads.map((line) => `  - ${line}`));
	}

	// Recent forum browse (only if within 10 ticks)
	const browseLine = formatRecentForumBrowse(memory, currentTick);
	if (browseLine) {
		lines.push("", browseLine.header);
		if (browseLine.threads.length > 0) {
			lines.push(...browseLine.threads.map((line) => `  - ${line}`));
		}
	}

	return `\n${lines.join("\n")}\n`;
}

type OkSummary = {
	category: "movement" | "economy" | "combat" | "info";
	text: string;
};

function summarizeOkPayload(
	payload: Record<string, unknown>,
): OkSummary | null {
	const action = String(payload.action ?? "");
	if (!action) return null;

	switch (action) {
		case "travel": {
			const target = String(payload.target_poi ?? "unknown");
			return { category: "movement", text: `Traveling to ${target}` };
		}
		case "arrived": {
			const poiId = String(payload.poi_id ?? "destination");
			return { category: "movement", text: `Arrived at ${poiId}` };
		}
		case "jump": {
			const target = String(payload.target_system ?? "unknown");
			return { category: "movement", text: `Jumping to ${target}` };
		}
		case "jumped": {
			const systemId = String(payload.system_id ?? "new system");
			return { category: "movement", text: `Jumped to ${systemId}` };
		}
		case "dock": {
			const baseId = String(payload.base_id ?? "base");
			return { category: "movement", text: `Docked at ${baseId}` };
		}
		case "undock": {
			return { category: "movement", text: "Undocked" };
		}
		case "mine": {
			const resource = String(payload.resource ?? "ore");
			const quantity = Number(payload.quantity ?? 0);
			return {
				category: "economy",
				text: `Mined ${quantity > 0 ? `${quantity}x ` : ""}${resource}`,
			};
		}
		case "buy": {
			const itemId = String(payload.item_id ?? "item");
			const quantity = Number(payload.quantity ?? 0);
			const cost = Number(payload.cost ?? 0);
			return {
				category: "economy",
				text: `Bought ${quantity}x ${itemId} for ${cost} credits`,
			};
		}
		case "sell": {
			const itemId = String(payload.item_id ?? "item");
			const quantity = Number(payload.quantity ?? 0);
			const revenue = Number(payload.revenue ?? 0);
			return {
				category: "economy",
				text: `Sold ${quantity}x ${itemId} for ${revenue} credits`,
			};
		}
		case "repair": {
			const cost = Number(payload.cost ?? 0);
			return {
				category: "economy",
				text: `Repaired ship (cost: ${cost} credits)`,
			};
		}
		case "refuel": {
			const cost = Number(payload.cost ?? 0);
			return {
				category: "economy",
				text: `Refueled ship (cost: ${cost} credits)`,
			};
		}
		case "attack": {
			const targetId = String(payload.target_id ?? "target");
			const damage = Number(payload.damage ?? 0);
			return {
				category: "combat",
				text: `Attacked ${targetId}${damage > 0 ? ` (${damage} damage)` : ""}`,
			};
		}
		default:
			return {
				category: "info",
				text: `OK: ${action}`,
			};
	}
}

function formatForumList(payload: Record<string, unknown>): string[] {
	const threads = findArrayField(payload, [
		"threads",
		"items",
		"results",
		"posts",
	]);
	if (!threads || threads.length === 0) return ["Forum list received"];

	const lines: string[] = ["Forum list:"];
	for (const item of threads.slice(0, 5)) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const id =
			getStringField(record, "id") ?? getStringField(record, "thread_id");
		const title =
			getStringField(record, "title") ?? getStringField(record, "subject");
		const category = getStringField(record, "category");
		const author =
			getStringField(record, "author") ?? getStringField(record, "username");
		const replies =
			getStringField(record, "reply_count") ??
			getStringField(record, "replies");
		const parts = [
			category ? `[${category}]` : null,
			title ? truncateText(title, 60) : "(untitled)",
			id ? `(id=${id})` : null,
			author ? `by ${author}` : null,
			replies ? `replies=${replies}` : null,
		].filter(Boolean);
		if (parts.length > 0) lines.push(parts.join(" "));
	}
	return lines;
}

function formatForumThread(payload: Record<string, unknown>): string[] {
	const thread = getObjectField(payload, "thread") ?? payload;
	const threadTitle =
		getStringField(thread, "title") ?? getStringField(thread, "subject");
	const threadId =
		getStringField(thread, "id") ?? getStringField(thread, "thread_id");
	const category = getStringField(thread, "category");

	const lines: string[] = [
		`Forum thread: ${threadTitle ? truncateText(threadTitle, 60) : "(untitled)"}`,
	];

	const headerParts = [
		threadId ? `id=${threadId}` : null,
		category ? `category=${category}` : null,
	].filter(Boolean);
	if (headerParts.length > 0) {
		lines[0] = `${lines[0]} (${headerParts.join(" ")})`;
	}

	const posts =
		findArrayField(payload, ["posts", "replies", "messages"]) ??
		findArrayField(thread, ["posts", "replies", "messages"]);
	if (!posts || posts.length === 0) return lines;

	lines.push("Posts:");
	for (const post of posts.slice(0, 3)) {
		if (!post || typeof post !== "object") continue;
		const record = post as Record<string, unknown>;
		const author =
			getStringField(record, "author") ??
			getStringField(record, "username") ??
			getStringField(record, "sender");
		const content =
			getStringField(record, "content") ??
			getStringField(record, "message") ??
			getStringField(record, "body");
		if (!content) continue;
		lines.push(`${author ? `${author}: ` : ""}${truncateText(content, 140)}`);
	}

	return lines;
}

function findArrayField(
	payload: Record<string, unknown>,
	keys: string[],
): unknown[] | null {
	for (const key of keys) {
		const value = payload[key];
		if (Array.isArray(value)) return value;
	}
	return null;
}

function getObjectField(
	payload: Record<string, unknown>,
	key: string,
): Record<string, unknown> | null {
	const value = payload[key];
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
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

function formatTickTime(tick: number, currentTick: number): string {
	if (tick === 0) return "T0 (before game start)";
	const diff = currentTick - tick;
	if (diff === 0) return `T${tick} (current)`;
	if (diff === 1) return `T${tick} (1 tick ago)`;
	if (diff < 0) return `T${tick} (future)`;
	return `T${tick} (${diff} ticks ago)`;
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
