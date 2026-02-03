import type {
	ChatMessageMessage,
	CombatUpdateMessage,
	ErrorMessage,
	LoggedInMessage,
	MiningYieldMessage,
	PlayerDiedMessage,
	RegisteredMessage,
	ScanResultMessage,
	ServerMessage,
	TradeOfferReceivedMessage,
	WelcomeMessage,
} from "./types.ts";

export function logServerMessage(
	instanceId: string,
	message: ServerMessage,
	verbose = false,
): void {
	const prefix = `[${instanceId}] ← ${message.type}`;

	switch (message.type) {
		case "welcome": {
			const p = (message as WelcomeMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Version: ${p.version} (${p.release_date})`);
			console.log(`  Tick rate: ${p.tick_rate}s, Current tick: ${p.current_tick}`);
			console.log(`  Server time: ${p.server_time}`);
			console.log(`  Website: ${p.website}`);
			if (p.motd) console.log(`  MOTD: ${p.motd}`);
			if (p.release_notes.length > 0) {
				console.log(`  Release notes:`);
				p.release_notes.forEach((note) => console.log(`    - ${note}`));
			}
			break;
		}
		case "registered": {
			const p = (message as RegisteredMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Player ID: ${p.player_id}`);
			console.log(`  Token: ${p.token.substring(0, 8)}...`);
			break;
		}
		case "logged_in": {
			const p = (message as LoggedInMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Player: ${p.player.username} (${p.player.empire})`);
			console.log(`  Credits: ${p.player.credits}, Location: ${p.system.name} > ${p.poi.name}`);
			if (!verbose) break;
			console.log(`  Home base: ${p.player.home_base || "none"}`);
			if (p.player.docked_at_base) console.log(`  Docked at: ${p.player.docked_at_base}`);
			if (p.player.status_message) console.log(`  Status: ${p.player.status_message}`);
			if (p.player.clan_tag) console.log(`  Clan: ${p.player.clan_tag}`);
			if (p.player.faction_id) {
				console.log(`  Faction: ${p.player.faction_id} (rank: ${p.player.faction_rank})`);
			}
			console.log(`  System: ${p.system.description || "No description"}`);
			console.log(
				`    Empire: ${p.system.empire || "neutral"}, Police: ${p.system.police_level || 0}`,
			);
			if (p.system.connections && p.system.connections.length > 0) {
				console.log(`    Connected to: ${p.system.connections.join(", ")}`);
			}
			console.log(`  POI: ${p.poi.type} - ${p.poi.description || "No description"}`);
			if (p.poi.base_id) console.log(`    Base: ${p.poi.base_id}`);
			if (p.poi.resources && p.poi.resources.length > 0) {
				console.log(`    Resources:`);
				p.poi.resources.forEach((r: any) =>
					console.log(`      - ${r.resource_id}: ${r.remaining} (richness: ${r.richness})`),
				);
			}
			console.log(`  Ship: ${p.ship.name} (${p.ship.class_id})`);
			console.log(
				`    Hull: ${p.ship.hull}/${p.ship.max_hull}, Shield: ${p.ship.shield}/${p.ship.max_shield} (regen: ${p.ship.shield_recharge})`,
			);
			console.log(`    Armor: ${p.ship.armor}, Speed: ${p.ship.speed}`);
			console.log(
				`    Fuel: ${p.ship.fuel}/${p.ship.max_fuel}, Cargo: ${p.ship.cargo_used}/${p.ship.cargo_capacity}`,
			);
			console.log(
				`    CPU: ${p.ship.cpu_used}/${p.ship.cpu_capacity}, Power: ${p.ship.power_used}/${p.ship.power_capacity}`,
			);
			if (p.ship.modules && p.ship.modules.length > 0) {
				console.log(`    Modules: ${p.ship.modules.join(", ")}`);
			}
			if (p.ship.cargo && p.ship.cargo.length > 0) {
				console.log(`    Cargo:`);
				p.ship.cargo.forEach((item: any) =>
					console.log(`      - ${item.item_id}: ${item.quantity}`),
				);
			}
			if (p.player.skills && Object.keys(p.player.skills).length > 0) {
				console.log(`  Skills:`);
				Object.entries(p.player.skills).forEach(([skill, data]: [string, any]) =>
					console.log(`    - ${skill}: level ${data.level} (${data.xp} XP)`),
				);
			}
			if (p.player.stats) {
				const s = p.player.stats;
				console.log(`  Stats:`);
				console.log(`    Ships destroyed: ${s.ships_destroyed}, Deaths: ${s.times_destroyed}`);
				console.log(`    Ore mined: ${s.ore_mined}, Items crafted: ${s.items_crafted}`);
				console.log(`    Credits earned: ${s.credits_earned}, spent: ${s.credits_spent}`);
				console.log(
					`    Trades: ${s.trades_completed}, Systems discovered: ${s.systems_discovered}`,
				);
			}
			break;
		}
		case "state_update": {
			const p = (message as any).payload;
			console.log(`${prefix} (tick ${p.tick})`);
			console.log(`  Player: ${p.player.username}, Credits: ${p.player.credits}`);
			console.log(
				`  Location: ${p.player.current_system} > ${p.player.current_poi}${p.player.docked_at_base ? ` (docked)` : ""}`,
			);
			if (!verbose) break;
			console.log(
				`  Ship: Hull ${p.ship.hull}/${p.ship.max_hull}, Shield ${p.ship.shield}/${p.ship.max_shield}`,
			);
			console.log(
				`    Fuel: ${p.ship.fuel}/${p.ship.max_fuel}, Cargo: ${p.ship.cargo_used}/${p.ship.cargo_capacity}`,
			);
			console.log(
				`    CPU: ${p.ship.cpu_used}/${p.ship.cpu_capacity}, Power: ${p.ship.power_used}/${p.ship.power_capacity}`,
			);
			if (p.in_combat) console.log(`  IN COMBAT`);
			if (p.player.is_cloaked) console.log(`  CLOAKED`);
			if (p.travel_progress !== undefined) {
				console.log(
					`  Traveling (${p.travel_type}): ${Math.round(p.travel_progress * 100)}% to ${p.travel_destination} (ETA: tick ${p.travel_arrival_tick})`,
				);
			}
			if (p.nearby && p.nearby.length > 0) {
				console.log(`  Nearby players: ${p.nearby.length}`);
				p.nearby.forEach((np: any) => {
					let info = `    - ${np.username}`;
					if (np.ship_class) info += ` (${np.ship_class})`;
					if (np.faction_tag) info += ` [${np.faction_tag}]`;
					if (np.in_combat) info += ` [COMBAT]`;
					if (np.status_message) info += ` - ${np.status_message}`;
					console.log(info);
				});
			}
			if (p.player.skills && Object.keys(p.player.skills).length > 0) {
				console.log(
					`  Skills: ${Object.entries(p.player.skills)
						.map(([s, d]: [string, any]) => `${s}:${d.level}`)
						.join(", ")}`,
				);
			}
			break;
		}
		case "error": {
			const p = (message as ErrorMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Code: ${p.code}`);
			console.log(`  Message: ${p.message}`);
			break;
		}
		case "tick": {
			const p = message.payload as { tick: number };
			console.log(`${prefix} ${p.tick}`);
			break;
		}
		case "ok": {
			const p = message.payload as any;
			if (!p || Object.keys(p).length === 0) {
				console.log(`${prefix}`);
			} else {
				console.log(`${prefix}`);
				logPayloadFields(p, "  ", verbose, { current: 0 });
			}
			break;
		}
		case "chat_message": {
			const p = (message as ChatMessageMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Channel: ${p.channel}`);
			console.log(`  From: ${p.sender} (${p.sender_id})`);
			console.log(`  Message: ${p.content}`);
			if (p.timestamp) console.log(`  Time: ${p.timestamp}`);
			break;
		}
		case "combat_update": {
			const p = (message as CombatUpdateMessage).payload;
			console.log(`${prefix} (tick ${p.tick})`);
			console.log(`  Attacker: ${p.attacker}`);
			console.log(`  Target: ${p.target}`);
			console.log(`  Damage: ${p.damage} ${p.damage_type || ""}`);
			if (p.shield_hit !== undefined) console.log(`  Shield hit: ${p.shield_hit}`);
			if (p.hull_hit !== undefined) console.log(`  Hull hit: ${p.hull_hit}`);
			if (p.destroyed) console.log(`  TARGET DESTROYED`);
			break;
		}
		case "player_died": {
			const p = (message as PlayerDiedMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Killed by: ${p.killer_name || "environment"}`);
			if (p.clone_cost) console.log(`  Clone cost: ${p.clone_cost}`);
			if (p.insurance_payout) console.log(`  Insurance payout: ${p.insurance_payout}`);
			if (p.ship_lost) console.log(`  Ship lost: ${p.ship_lost}`);
			if (p.respawn_base) console.log(`  Respawn at: ${p.respawn_base}`);
			if (p.wreck_id) console.log(`  Wreck ID: ${p.wreck_id}`);
			break;
		}
		case "mining_yield": {
			const p = (message as MiningYieldMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Resource: ${p.resource_id}`);
			console.log(`  Quantity: ${p.quantity}`);
			if (p.remaining !== undefined) console.log(`  Remaining: ${p.remaining}`);
			break;
		}
		case "scan_result": {
			const p = (message as ScanResultMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Target: ${p.target_id}`);
			console.log(`  Success: ${p.success}`);
			if (p.revealed_info) console.log(`  Revealed: ${p.revealed_info.join(", ")}`);
			if (p.username) console.log(`  Username: ${p.username}`);
			if (p.ship_class) console.log(`  Ship class: ${p.ship_class}`);
			if (p.hull !== undefined) console.log(`  Hull: ${p.hull}`);
			if (p.shield !== undefined) console.log(`  Shield: ${p.shield}`);
			break;
		}
		case "trade_offer_received": {
			const p = (message as TradeOfferReceivedMessage).payload;
			console.log(`${prefix}`);
			console.log(`  Trade ID: ${p.trade_id}`);
			console.log(`  From: ${p.from_name} (${p.from_player})`);
			console.log(`  Offering:`);
			if (p.offer_items && p.offer_items.length > 0) {
				p.offer_items.forEach((item: any) =>
					console.log(`    - ${item.item_id}: ${item.quantity}`),
				);
			}
			if (p.offer_credits > 0) console.log(`    - Credits: ${p.offer_credits}`);
			console.log(`  Requesting:`);
			if (p.request_items && p.request_items.length > 0) {
				p.request_items.forEach((item: any) =>
					console.log(`    - ${item.item_id}: ${item.quantity}`),
				);
			}
			if (p.request_credits > 0) console.log(`    - Credits: ${p.request_credits}`);
			break;
		}
		default:
			console.log(`${prefix}`);
			if ((message as any).payload) {
				logPayloadFields((message as any).payload, "  ", verbose, { current: 0 });
			}
	}
}

export function logPayloadFields(
	payload: any,
	indent: string,
	verbose = false,
	lineCount = { current: 0 },
): void {
	if (!payload || typeof payload !== "object") {
		console.log(`${indent}${String(payload)}`);
		lineCount.current++;
		return;
	}

	for (const [key, value] of Object.entries(payload)) {
		if (!verbose && lineCount.current >= 2) {
			return;
		}

		if (value === null || value === undefined) {
			continue;
		} else if (Array.isArray(value)) {
			if (value.length === 0) {
				console.log(`${indent}${key}: []`);
				lineCount.current++;
			} else if (typeof value[0] === "object") {
				console.log(`${indent}${key}: [${value.length} items]`);
				lineCount.current++;
				if (verbose) {
					value.forEach((item, idx) => {
						console.log(`${indent}  [${idx}]:`);
						logPayloadFields(item, `${indent}    `, verbose, lineCount);
					});
				}
			} else {
				console.log(`${indent}${key}: [${value.join(", ")}]`);
				lineCount.current++;
			}
		} else if (typeof value === "object") {
			console.log(`${indent}${key}:`);
			lineCount.current++;
			if (verbose || lineCount.current < 2) {
				logPayloadFields(value, `${indent}  `, verbose, lineCount);
			}
		} else if (typeof value === "string") {
			if (value.length > 100) {
				console.log(`${indent}${key}: ${value.substring(0, 100)}...`);
			} else {
				console.log(`${indent}${key}: ${value}`);
			}
			lineCount.current++;
		} else {
			console.log(`${indent}${key}: ${value}`);
			lineCount.current++;
		}
	}
}

export function formatPayload(payload: unknown): string {
	if (typeof payload !== "object" || payload === null) {
		return String(payload);
	}

	const obj = payload as Record<string, unknown>;
	const parts: string[] = [];

	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === "string") {
			if (value.length > 50) {
				parts.push(`${key}: "${value.substring(0, 47)}..."`);
			} else {
				parts.push(`${key}: "${value}"`);
			}
		} else if (typeof value === "number" || typeof value === "boolean") {
			parts.push(`${key}: ${value}`);
		} else if (Array.isArray(value)) {
			if (value.length === 0) {
				parts.push(`${key}: []`);
			} else if (typeof value[0] === "object") {
				const items = value.map((item) => JSON.stringify(item)).join(", ");
				if (items.length > 100) {
					parts.push(`${key}: [${value.length} items: ${items.substring(0, 97)}...]`);
				} else {
					parts.push(`${key}: [${items}]`);
				}
			} else {
				const joined = value.join(", ");
				if (joined.length > 100) {
					parts.push(`${key}: [${joined.substring(0, 97)}...]`);
				} else {
					parts.push(`${key}: [${joined}]`);
				}
			}
		} else if (value !== null && typeof value === "object") {
			const str = JSON.stringify(value);
			if (str.length > 100) {
				parts.push(`${key}: ${str.substring(0, 97)}...`);
			} else {
				parts.push(`${key}: ${str}`);
			}
		} else {
			parts.push(`${key}: ${String(value)}`);
		}
	}

	return parts.join(", ");
}
