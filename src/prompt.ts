import type { ClientState } from "../client/src/client";
import type { Base, POI, System } from "../client/src/types";
import type { StoredAction, StoredEvent } from "./memory";

export interface PromptContext {
  state: ClientState;
  worldSnapshot?: WorldSnapshot;
  recentActions: StoredAction[];
  recentEvents: StoredEvent[];
  includeHelp: boolean;
}

export interface WorldSnapshot {
  system?: System | null;
  pois?: POI[];
  poi?: POI | null;
  base?: Base | null;
}

const HELP_TEXT = `SpaceMolt Reference Client
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
  quit                          - Exit client (or press Ctrl+D)
`;

export function buildActionPrompt(context: PromptContext): string {
  const stateText = formatState(context.state);
  const worldText = formatWorldSnapshot(context.state, context.worldSnapshot);
  const memoryText = formatMemory(context.recentActions, context.recentEvents);
  const helpBlock = context.includeHelp ? `\nHELP MENU:\n${HELP_TEXT}` : "";

  return `You are an autonomous player for the SpaceMolt MMO (https://www.spacemolt.com/).
You will receive current game state and recent events. Choose exactly one action to perform next.
Respond ONLY with a single JSON object. No extra text.
${helpBlock}

CURRENT STATE:
${stateText}

WORLD SNAPSHOT:
${worldText}

RECENT MEMORY:
${memoryText}

ACTION SCHEMA (JSON ONLY):
{"action":"travel|jump|dock|undock|mine|attack|scan|buy|sell|refuel|repair|craft|chat|status|system|poi|base|skills|recipes|version|nearby|cargo|wait","args":{...}}

REQUIRED ARGS:
- travel: {"target_poi":"..."}
- jump: {"target_system":"..."}
- attack: {"target_id":"..."}
- scan: {"target_id":"..."}
- buy: {"listing_id":"...","quantity":number}
- sell: {"item_id":"...","quantity":number}
- craft: {"recipe_id":"..."}
- chat: {"channel":"local|faction|private","content":"...","target_id":"..." if channel is private}

NOTES:
- Use only the listed actions.
- If an action requires args and you do not know valid values, use {"action":"wait"}.
- Never omit required args or leave them blank.
- IDs must come from the current state or world snapshot.
- If unsure, use {"action":"wait"}.

EXAMPLES (valid JSON only):
{"action":"wait"}
{"action":"mine"}
{"action":"travel","args":{"target_poi":"poi_id_here"}}
{"action":"sell","args":{"item_id":"ore_iron","quantity":10}}
{"action":"chat","args":{"channel":"local","content":"Hello"}}
`;
}

export function buildRegistrationPrompt(includeHelp: boolean, failedNames: string[] = []): string {
  const helpBlock = includeHelp ? `\nHELP MENU:\n${HELP_TEXT}` : "";
  const failedBlock = failedNames.length
    ? `\nPreviously rejected usernames (do NOT reuse): ${failedNames.join(", ")}`
    : "";
  return `You are creating a SpaceMolt account. Choose a short, memorable username and an empire.
The username MUST be unique and original. Do not reuse any prior suggestions.
To maximize uniqueness, include a distinctive suffix (digits or a short tag).
Respond ONLY with JSON. No extra text.
${helpBlock}
${failedBlock}

JSON SCHEMA:
{"username":"...","empire":"solarian|voidborn|crimson|nebula|outerrim"}
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

  lines.push(`Player: ${player.username} [${player.empire}] credits=${player.credits}`);
  lines.push(`Location: ${system?.name ?? player.current_system} - ${poi?.name ?? player.current_poi}`);
  lines.push(`Docked: ${player.docked_at_base ? "yes" : "no"} | In combat: ${state.inCombat ? "yes" : "no"}`);
  lines.push(`Ship: hull ${ship.hull}/${ship.max_hull} shield ${ship.shield}/${ship.max_shield} fuel ${ship.fuel}/${ship.max_fuel}`);
  lines.push(`Cargo: ${ship.cargo_used}/${ship.cargo_capacity}`);
  if (ship.cargo?.length) {
    lines.push(
      `Cargo items: ${ship.cargo.map((item) => `${item.item_id}(${item.quantity})`).join(", ")}`
    );
  } else {
    lines.push("Cargo items: none");
  }
  if (base) {
    lines.push(`Base: ${base.name} services=${Object.keys(base.services).filter((k) => (base.services as Record<string, boolean>)[k]).join(",")}`);
  }
  if (poi?.resources?.length) {
    lines.push(
      `Current POI resources: ${poi.resources
        .map((r) => `${r.resource_id}(${r.richness},${r.remaining})`)
        .join(", ")}`
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

function formatWorldSnapshot(state: ClientState, snapshot?: WorldSnapshot): string {
  const system = snapshot?.system ?? state.system;
  const currentPoi = snapshot?.poi ?? state.poi;
  const base = snapshot?.base ?? state.base;
  const pois = snapshot?.pois ?? [];
  const lines: string[] = [];

  if (!system) {
    const systemId = state.player?.current_system;
    lines.push(systemId ? `System: ${systemId} (details unavailable)` : "System details unavailable.");
    return lines.join("\n");
  }

  lines.push(`System: ${system.name} (${system.id}) police=${system.police_level}`);
  if (system.connections?.length) {
    lines.push(`Connections: ${system.connections.join(", ")}`);
  }

  if (currentPoi) {
    lines.push(`Current POI: ${currentPoi.name} (${currentPoi.id}) type=${currentPoi.type}`);
    if (currentPoi.resources?.length) {
      lines.push(
        `Current POI resources: ${currentPoi.resources
          .map((r) => `${r.resource_id}(${r.richness},${r.remaining})`)
          .join(", ")}`
      );
    } else {
      lines.push("Current POI resources: none");
    }
  } else if (state.player?.current_poi) {
    lines.push(`Current POI: ${state.player.current_poi} (details unavailable)`);
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
      lines.push(`- ${poi.id} ${poi.type} ${poi.name}${position}${resources}${baseRef}`.trim());
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
    lines.push(`Base: ${base.name} (${base.id}) services=${services || "none"}`);
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

function formatMemory(actions: StoredAction[], events: StoredEvent[]): string {
  const lines: string[] = [];

  if (actions.length === 0 && events.length === 0) {
    return "(no recent memory)";
  }

  if (actions.length > 0) {
    lines.push("Actions:");
    for (const action of actions) {
      lines.push(`- ${action.ts} ${action.action} ${action.args ?? ""}`.trim());
    }
  }

  if (events.length > 0) {
    lines.push("Events:");
    for (const event of events) {
      lines.push(`- ${event.ts} ${event.type} ${event.payload ?? ""}`.trim());
    }
  }

  return lines.join("\n");
}
