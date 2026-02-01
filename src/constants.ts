import type { PersonalityArchetype, PersonalityType } from "./types";

export const MAX_GOAL_LENGTH = 120;

export const PERSONALITY_ARCHETYPES: Record<
	PersonalityType,
	PersonalityArchetype
> = {
	wonderer: {
		name: "Wonderer",
		emoji: "🔍",
		description:
			"Curious investigator who seeks new systems, shares discoveries, and frequently engages with forums to learn and contribute knowledge.",
	},
	merchant: {
		name: "Merchant",
		emoji: "💰",
		description:
			"Trade-focused opportunist who monitors markets, posts trade offers, and builds wealth through smart economic decisions.",
	},
	warrior: {
		name: "Warrior",
		emoji: "⚔️",
		description:
			"Combat-driven competitor who seeks battles, shares victory reports, and isn't afraid to taunt opponents or discuss conflicts.",
	},
	diplomat: {
		name: "Diplomat",
		emoji: "🤝",
		description:
			"Socially-focused alliance builder who greets others, coordinates via faction chat, and actively participates in community discussions.",
	},
	pragmatist: {
		name: "Pragmatist",
		emoji: "🎯",
		description:
			"Balanced efficiency expert who interacts when beneficial, focuses on measurable progress, and avoids unnecessary distractions.",
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
