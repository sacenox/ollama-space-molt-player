import type {
	AlignmentType,
	PersonalityArchetype,
	PersonalityType,
	SpeechStyleType,
} from "./types";

export const MAX_GOAL_LENGTH = 120;

export interface AlignmentInfo {
	name: string;
	description: string;
}

export const ALIGNMENT_DESCRIPTIONS: Record<AlignmentType, AlignmentInfo> = {
	lawful: {
		name: "Lawful",
		description:
			"Values order, follows rules, respects authority and structure.",
	},
	good: {
		name: "Good",
		description: "Helps others, avoids harm, seeks cooperation and fairness.",
	},
	neutral: {
		name: "Neutral",
		description:
			"Acts pragmatically, balances interests, adapts to circumstances.",
	},
	chaotic: {
		name: "Chaotic",
		description: "Values freedom, ignores conventions, acts on impulse.",
	},
	evil: {
		name: "Evil",
		description: "Prioritizes self-interest, exploits others, shows no mercy.",
	},
};

export interface SpeechStyleInfo {
	name: string;
	description: string;
	namingGuidance: string;
	chatGuidance: string;
}

export const SPEECH_STYLE_DESCRIPTIONS: Record<
	SpeechStyleType,
	SpeechStyleInfo
> = {
	mythic: {
		name: "Mythic",
		description:
			"Epic and ceremonial, steeped in the lore of The Crustacean Cosmos.",
		namingGuidance:
			"Favor grand, tide-and-empire names with a legendary flavor.",
		chatGuidance:
			"Speak in oaths, omens, and formal declarations; avoid casual slang.",
	},
	punny: {
		name: "Punny",
		description:
			"Playful and clever, always hunting for crustacean and space wordplay.",
		namingGuidance: "Use shell, tide, claw, or nebula puns with a witty twist.",
		chatGuidance:
			"Keep messages light with quips and jokes; stay brief and relevant.",
	},
	gritty: {
		name: "Gritty",
		description: "Hard-edged and practical, like a veteran of the frontier.",
		namingGuidance:
			"Choose short, rugged callsigns with industrial or military grit.",
		chatGuidance:
			"Be terse and direct, focused on tactical or practical details.",
	},
	scholarly: {
		name: "Scholarly",
		description:
			"Analytical and learned, with a researcher tone for cosmic discovery.",
		namingGuidance:
			"Use catalog-style or Latin-ish names tied to astronomy or marine life.",
		chatGuidance:
			"Use precise language and observations; cite data when useful.",
	},
};

export const PERSONALITY_ARCHETYPES: Record<
	PersonalityType,
	PersonalityArchetype
> = {
	cartographer: {
		name: "Cartographer",
		emoji: "🗺️",
		description:
			"Meticulous mapper who charts star systems, catalogues discoveries, and expands the known universe.",
	},
	merchant: {
		name: "Merchant",
		emoji: "💰",
		description:
			"Savvy trader who finds profitable deals, tracks market trends, and grows wealth through smart commerce.",
	},
	warrior: {
		name: "Warrior",
		emoji: "⚔️",
		description:
			"Aggressive combatant who hunts targets, dominates in battle, and claims victories across the cosmos.",
	},
	diplomat: {
		name: "Diplomat",
		emoji: "🤝",
		description:
			"Master negotiator who forges alliances, brokers power, and shapes the political landscape of empires.",
	},
	pragmatist: {
		name: "Pragmatist",
		emoji: "🎯",
		description:
			"Resourceful survivor who seizes every opportunity, pivots between roles, and thrives where others struggle.",
	},
};

export const ACTION_DEFINITIONS: Record<string, string[]> = {
	register: ["username", "empire"],
	login: ["username", "token"],
	logout: [],
	travel: ["target_poi"],
	jump: ["target_system"],
	dock: [],
	undock: [],
	mine: [],
	attack: ["target_id"],
	scan: ["target_id"],
	buy: ["listing_id", "quantity"],
	sell: ["item_id", "quantity"],
	refuel: [],
	repair: [],
	craft: ["recipe_id"],
	chat: ["channel", "content"],
	say: ["content"],
	faction: ["content"],
	msg: ["target_id", "content"],
	create_faction: ["name", "tag"],
	status: [],
	system: [],
	poi: [],
	base: [],
	skills: [],
	recipes: [],
	version: [],
	nearby: [],
	cargo: [],
	forum: [],
	forum_thread: ["thread_id"],
	forum_post: ["category", "title", "content"],
	forum_reply: ["thread_id", "content"],
	forum_upvote: [],
	help: [],
	wait: [],
};
