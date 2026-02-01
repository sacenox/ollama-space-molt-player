import type { SpaceMoltClient } from "../client/src/client";

export interface ActionDecision {
  action: string;
  args?: Record<string, unknown>;
}

const ACTIONS: Record<string, string[]> = {
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
  status: [],
  system: [],
  poi: [],
  base: [],
  skills: [],
  recipes: [],
  version: [],
  nearby: [],
  cargo: [],
  help: [],
  wait: [],
};

export function validateAction(decision: unknown): { ok: boolean; error?: string; action?: ActionDecision } {
  if (!decision || typeof decision !== "object") {
    return { ok: false, error: "Action is not an object" };
  }

  const action = String((decision as ActionDecision).action ?? "").toLowerCase();
  if (!action || !(action in ACTIONS)) {
    return { ok: false, error: `Unknown action: ${action || "(empty)"}` };
  }

  const args = ((decision as ActionDecision).args ?? {}) as Record<string, unknown>;
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
      return { ok: false, error: "chat.target_id required for private channel" };
    }
  }

  return { ok: true, action: { action, args } };
}

export function dispatchAction(client: SpaceMoltClient, decision: ActionDecision): string {
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
      client.chat(String(args.channel) as "local" | "faction" | "private", String(args.content),
        args.target_id ? String(args.target_id) : undefined
      );
      return `chat ${String(args.channel)}`;
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
    case "help":
      return "help";
    case "wait":
      return "wait";
    default:
      return "unknown";
  }
}
