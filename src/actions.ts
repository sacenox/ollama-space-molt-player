import type { SpaceMoltClient } from "../client/src/client";
import { ACTION_DEFINITIONS, MAX_MISSION_LENGTH } from "./constants";
import type { ActionDecision } from "./types";

export { MAX_MISSION_LENGTH, PERSONALITY_ARCHETYPES } from "./constants";
export type { ActionDecision, PersonalityType } from "./types";

export function validateAction(decision: unknown): {
	ok: boolean;
	error?: string;
	action?: ActionDecision;
} {
	if (!decision || typeof decision !== "object") {
		return { ok: false, error: "Action is not an object" };
	}

	const mission = String((decision as ActionDecision).mission ?? "").trim();
	if (!mission) {
		return { ok: false, error: "Missing mission" };
	}
	if (mission.length > MAX_MISSION_LENGTH) {
		return {
			ok: false,
			error: `Mission exceeds ${MAX_MISSION_LENGTH} characters`,
		};
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
		if (
			!channel ||
			!["local", "system", "faction", "private", "global"].includes(channel)
		) {
			return {
				ok: false,
				error: "chat.channel must be local|system|faction|private|global",
			};
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

	if (action === "create_faction") {
		const name = String(args.name ?? "").trim();
		const tag = String(args.tag ?? "").trim();
		if (!name) {
			return { ok: false, error: "create_faction.name is required" };
		}
		if (!tag) {
			return { ok: false, error: "create_faction.tag is required" };
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

	if (action === "set_status") {
		const statusMessage = String(args.status_message ?? "").trim();
		const clanTag = String(args.clan_tag ?? "").trim();
		if (!statusMessage && !clanTag) {
			return {
				ok: false,
				error: "set_status requires status_message or clan_tag",
			};
		}
	}

	if (action === "set_colors") {
		const primaryColor = String(args.primary_color ?? "").trim();
		const secondaryColor = String(args.secondary_color ?? "").trim();
		if (!primaryColor) {
			return { ok: false, error: "set_colors.primary_color is required" };
		}
		if (!secondaryColor) {
			return { ok: false, error: "set_colors.secondary_color is required" };
		}
	}

	if (action === "set_anonymous") {
		if (typeof args.anonymous !== "boolean") {
			return {
				ok: false,
				error: "set_anonymous.anonymous must be a boolean",
			};
		}
	}

	return { ok: true, action: { action, args, mission } };
}

export function dispatchAction(
	client: SpaceMoltClient,
	decision: ActionDecision,
): string {
	const args = decision.args ?? {};

	switch (decision.action) {
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
		case "create_faction": {
			const name = String(args.name);
			const tag = String(args.tag);
			client.createFaction(name, tag);
			return `create faction ${name} [${tag}]`;
		}
		case "set_status": {
			const statusMessage = String(args.status_message ?? "");
			const clanTag = String(args.clan_tag ?? "");
			client.setStatus(statusMessage, clanTag);
			return `set status "${statusMessage}" [${clanTag}]`;
		}
		case "set_colors": {
			const primaryColor = String(args.primary_color);
			const secondaryColor = String(args.secondary_color);
			client.setColors(primaryColor, secondaryColor);
			return `set colors ${primaryColor}/${secondaryColor}`;
		}
		case "set_anonymous": {
			const anonymous = Boolean(args.anonymous);
			client.setAnonymous(anonymous);
			return `set anonymous ${anonymous}`;
		}
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
