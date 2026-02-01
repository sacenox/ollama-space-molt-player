import type { SpaceMoltClient } from "../client/src/client";
import type { EmpireID } from "../client/src/types";

export interface ActionDecision {
	action: string;
	args?: Record<string, unknown>;
	goal?: string;
}

export const MAX_GOAL_LENGTH = 120;

export type PersonalityType =
	| "wonderer"
	| "merchant"
	| "warrior"
	| "diplomat"
	| "pragmatist";

export const PERSONALITY_ARCHETYPES: Record<
	PersonalityType,
	{ name: string; emoji: string; description: string }
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

const ACTIONS: Record<string, string[]> = {
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

export function validateAction(decision: unknown): {
	ok: boolean;
	error?: string;
	action?: ActionDecision;
} {
	if (!decision || typeof decision !== "object") {
		return { ok: false, error: "Action is not an object" };
	}

	const goal = String((decision as ActionDecision).goal ?? "").trim();
	if (!goal) {
		return { ok: false, error: "Missing goal" };
	}
	if (goal.length > MAX_GOAL_LENGTH) {
		return { ok: false, error: `Goal exceeds ${MAX_GOAL_LENGTH} characters` };
	}

	const action = String(
		(decision as ActionDecision).action ?? "",
	).toLowerCase();
	if (!action || !(action in ACTIONS)) {
		return { ok: false, error: `Unknown action: ${action || "(empty)"}` };
	}

	const args = ((decision as ActionDecision).args ?? {}) as Record<
		string,
		unknown
	>;
	if (typeof args !== "object" || Array.isArray(args)) {
		return { ok: false, error: "Args must be an object" };
	}

	const required = ACTIONS[action];
	for (const key of required) {
		if (!(key in args)) {
			return { ok: false, error: `Missing arg: ${key}` };
		}
	}

	if (action === "buy" || action === "sell") {
		const quantity = Number(args.quantity);
		if (!Number.isFinite(quantity) || quantity <= 0) {
			return { ok: false, error: "quantity must be a positive number" };
		}
	}

	if (action === "chat") {
		const channel = String(args.channel ?? "");
		if (!channel || !["local", "faction", "private"].includes(channel)) {
			return { ok: false, error: "chat.channel must be local|faction|private" };
		}
		const content = String(args.content ?? "");
		if (!content) {
			return { ok: false, error: "chat.content is required" };
		}
		if (channel === "private" && !args.target_id) {
			return {
				ok: false,
				error: "chat.target_id required for private channel",
			};
		}
	}

	if (action === "say" || action === "faction") {
		const content = String(args.content ?? "");
		if (!content) {
			return { ok: false, error: `${action}.content is required` };
		}
	}

	if (action === "msg") {
		const targetId = String(args.target_id ?? "");
		const content = String(args.content ?? "");
		if (!targetId) {
			return { ok: false, error: "msg.target_id is required" };
		}
		if (!content) {
			return { ok: false, error: "msg.content is required" };
		}
	}

	if (action === "register") {
		const username = String(args.username ?? "").trim();
		const empire = String(args.empire ?? "").trim();
		const personality = String(args.personality ?? "").trim();
		if (!username) {
			return { ok: false, error: "register.username is required" };
		}
		if (!empire) {
			return { ok: false, error: "register.empire is required" };
		}
		if (!isValidEmpire(empire)) {
			return { ok: false, error: "register.empire is invalid" };
		}
		if (!personality) {
			return { ok: false, error: "register.personality is required" };
		}
		if (!isValidPersonality(personality)) {
			return { ok: false, error: "register.personality is invalid" };
		}
	}

	if (action === "login") {
		const username = String(args.username ?? "").trim();
		const token = String(args.token ?? "").trim();
		if (!username) {
			return { ok: false, error: "login.username is required" };
		}
		if (!token) {
			return { ok: false, error: "login.token is required" };
		}
	}

	if (action === "forum") {
		if (args.page !== undefined) {
			const page = Number(args.page);
			if (!Number.isFinite(page) || page < 0) {
				return { ok: false, error: "forum.page must be a non-negative number" };
			}
		}
		if (args.category !== undefined) {
			const category = String(args.category ?? "").trim();
			if (!category) {
				return { ok: false, error: "forum.category cannot be empty" };
			}
		}
	}

	if (action === "forum_thread") {
		const threadId = String(args.thread_id ?? "").trim();
		if (!threadId) {
			return { ok: false, error: "forum_thread.thread_id is required" };
		}
	}

	if (action === "forum_post") {
		const category = String(args.category ?? "").trim();
		const title = String(args.title ?? "").trim();
		const content = String(args.content ?? "").trim();
		if (!category) {
			return { ok: false, error: "forum_post.category is required" };
		}
		if (!title) {
			return { ok: false, error: "forum_post.title is required" };
		}
		if (!content) {
			return { ok: false, error: "forum_post.content is required" };
		}
	}

	if (action === "forum_reply") {
		const threadId = String(args.thread_id ?? "").trim();
		const content = String(args.content ?? "").trim();
		if (!threadId) {
			return { ok: false, error: "forum_reply.thread_id is required" };
		}
		if (!content) {
			return { ok: false, error: "forum_reply.content is required" };
		}
	}

	if (action === "forum_upvote") {
		const threadId = String(args.thread_id ?? "").trim();
		const replyId = String(args.reply_id ?? "").trim();
		if (!threadId && !replyId) {
			return {
				ok: false,
				error: "forum_upvote requires thread_id or reply_id",
			};
		}
	}

	return { ok: true, action: { action, args, goal } };
}

function isValidEmpire(empire: string): empire is EmpireID {
	return ["solarian", "voidborn", "crimson", "nebula", "outerrim"].includes(
		empire,
	);
}

function isValidPersonality(
	personality: string,
): personality is PersonalityType {
	return ["wonderer", "merchant", "warrior", "diplomat", "pragmatist"].includes(
		personality,
	);
}

export function dispatchAction(
	client: SpaceMoltClient,
	decision: ActionDecision,
): string {
	const args = decision.args ?? {};

	switch (decision.action) {
		case "register":
			client.register(String(args.username), String(args.empire) as EmpireID);
			return `register ${String(args.username)}`;
		case "login":
			client.login(String(args.username), String(args.token));
			return `login ${String(args.username)}`;
		case "logout":
			client.logout();
			return "logout";
		case "travel":
			client.travel(String(args.target_poi));
			return `travel ${String(args.target_poi)}`;
		case "jump":
			client.jump(String(args.target_system));
			return `jump ${String(args.target_system)}`;
		case "dock":
			client.dock();
			return "dock";
		case "undock":
			client.undock();
			return "undock";
		case "mine":
			client.mine();
			return "mine";
		case "attack":
			client.attack(String(args.target_id));
			return `attack ${String(args.target_id)}`;
		case "scan":
			client.scan(String(args.target_id));
			return `scan ${String(args.target_id)}`;
		case "buy":
			client.buy(String(args.listing_id), Number(args.quantity));
			return `buy ${String(args.listing_id)} x${Number(args.quantity)}`;
		case "sell":
			client.sell(String(args.item_id), Number(args.quantity));
			return `sell ${String(args.item_id)} x${Number(args.quantity)}`;
		case "refuel":
			client.refuel();
			return "refuel";
		case "repair":
			client.repair();
			return "repair";
		case "craft":
			client.craft(String(args.recipe_id));
			return `craft ${String(args.recipe_id)}`;
		case "chat":
			client.chat(
				String(args.channel) as "local" | "faction" | "private",
				String(args.content),
				args.target_id ? String(args.target_id) : undefined,
			);
			return `chat ${String(args.channel)}`;
		case "say":
			client.localChat(String(args.content));
			return "say";
		case "faction":
			client.factionChat(String(args.content));
			return "faction";
		case "msg":
			client.privateMessage(String(args.target_id), String(args.content));
			return `msg ${String(args.target_id)}`;
		case "status":
			client.getStatus();
			return "get status";
		case "system":
			client.getSystem();
			return "get system";
		case "poi":
			client.getPOI();
			return "get poi";
		case "base":
			client.getBase();
			return "get base";
		case "skills":
			client.getSkills();
			return "get skills";
		case "recipes":
			client.getRecipes();
			return "get recipes";
		case "version":
			client.getVersion();
			return "get version";
		case "nearby":
			return "nearby (from state)";
		case "cargo":
			return "cargo (from state)";
		case "forum": {
			const page = args.page !== undefined ? Number(args.page) : undefined;
			const category =
				args.category !== undefined ? String(args.category) : undefined;
			if (page === undefined && category === undefined) {
				client.forumList();
			} else if (category === undefined) {
				client.forumList(page ?? 0);
			} else {
				client.forumList(page ?? 0, category);
			}
			return "forum list";
		}
		case "forum_thread":
			client.forumGetThread(String(args.thread_id));
			return `forum thread ${String(args.thread_id)}`;
		case "forum_post":
			client.forumCreateThread(
				String(args.title),
				String(args.content),
				String(args.category),
			);
			return "forum post";
		case "forum_reply":
			client.forumReply(String(args.thread_id), String(args.content));
			return `forum reply ${String(args.thread_id)}`;
		case "forum_upvote":
			if (args.thread_id) {
				client.forumUpvote(String(args.thread_id));
				return `forum upvote ${String(args.thread_id)}`;
			}
			if (args.reply_id) {
				client.forumUpvote(undefined, String(args.reply_id));
				return `forum upvote ${String(args.reply_id)}`;
			}
			return "forum upvote";
		case "help":
			return "help";
		case "wait":
			return "wait";
		default:
			return "unknown";
	}
}
