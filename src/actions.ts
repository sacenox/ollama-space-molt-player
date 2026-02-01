import type { SpaceMoltClient } from "../client/src/client";
import type { EmpireID } from "../client/src/types";
import { ACTION_DEFINITIONS, MAX_GOAL_LENGTH } from "./constants";
import type { ActionDecision } from "./types";
import { isValidEmpire, isValidPersonality } from "./utils";

export { MAX_GOAL_LENGTH, PERSONALITY_ARCHETYPES } from "./constants";
export type { ActionDecision, PersonalityType } from "./types";

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
	if (!action || !(action in ACTION_DEFINITIONS)) {
		return { ok: false, error: `Unknown action: ${action || "(empty)"}` };
	}

	const args = ((decision as ActionDecision).args ?? {}) as Record<
		string,
		unknown
	>;
	if (typeof args !== "object" || Array.isArray(args)) {
		return { ok: false, error: "Args must be an object" };
	}

	const required = ACTION_DEFINITIONS[action];
	for (const key of required) {
		if (!(key in args)) {
			return { ok: false, error: `Missing arg: ${key}` };
		}
	}

	// Validation logic
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
