import type { BaseCommand, ServerMessage } from "./types.ts";

const SUMMARY_MAX_LENGTH = 140;
const DETAIL_LINE_MAX_LENGTH = 200;

export type LogContext = {
	tick: number;
	instanceId: string;
	username?: string | null;
	verbose: boolean;
};

type LogDirection = "in" | "out";
type LogLevel = "info" | "warn" | "error";

export function log(
	context: LogContext,
	direction: LogDirection,
	summary: string,
	details?: unknown,
	level: LogLevel = "info",
): void {
	const identifier = context.username || context.instanceId;
	const tick = Number.isFinite(context.tick) ? context.tick : 0;
	const arrow = direction === "in" ? "←" : "→";
	const header = `${tick} | [${identifier}] | ${arrow} | ${summary}`;
	const lines = formatDetailLines(details, context.verbose);
	const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
	logger(header);
	if (lines.length > 0) {
		lines.forEach((line) => logger(`  ${line}`));
	}
}

export function logServerMessage(context: LogContext, message: ServerMessage): void {
	const summary = getServerSummary(message);
	const details = getServerDetails(message, context.verbose);
	log(context, "in", summary, details);
}

export function logClientCommand(context: LogContext, command: BaseCommand): void {
	const maskedPayload = maskSensitiveData(command.payload);
	const summary = command.payload
		? `${command.type} (${formatPayload(maskedPayload, SUMMARY_MAX_LENGTH)})`
		: command.type;
	log(context, "out", summary, maskedPayload);
}

export function logClientEvent(context: LogContext, message: string, details?: unknown): void {
	log(context, "out", message, details);
}

export function logClientWarning(context: LogContext, message: string, details?: unknown): void {
	log(context, "out", message, details, "warn");
}

export function logClientError(context: LogContext, message: string, details?: unknown): void {
	const normalized = normalizeErrorDetails(details);
	log(context, "out", message, normalized, "error");
}

export function logThinking(context: LogContext, thinking: string): void {
	const formatted = formatThinking(thinking, context.verbose);
	log(context, "out", "thinking", formatted);
}

export function formatThinking(thinking: string, verbose: boolean): string {
	if (verbose) {
		return thinking;
	}

	const sentences = splitSentences(thinking);
	if (sentences.length <= 3) {
		return sentences.join(" ").trim();
	}
	const first = sentences[0];
	const lastTwo = sentences.slice(-2);
	const omittedCount = sentences.length - 3;
	return `${first} [... ${omittedCount} sentences omitted ...] ${lastTwo.join(" ")}`.trim();
}

function splitSentences(text: string): string[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) {
		return [];
	}
	const matches = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
	if (!matches) {
		return [normalized];
	}
	return matches.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

function normalizeErrorDetails(details: unknown): unknown {
	if (details instanceof Error) {
		return {
			message: details.message,
			stack: details.stack,
		};
	}
	return details;
}

function formatDetailLines(details: unknown, verbose: boolean): string[] {
	if (details === undefined || details === null) {
		return [];
	}
	if (typeof details === "string") {
		return formatMultiline(details, verbose);
	}
	return formatPayloadLines(details, "", verbose, { current: 0 });
}

function formatMultiline(text: string, verbose: boolean): string[] {
	const lines = text.split("\n");
	const truncated =
		verbose || lines.length <= 5
			? lines
			: [lines[0], `[... ${lines.length - 4} more lines ...]`, ...lines.slice(-3)];
	return truncated.map((line) => truncateLine(line));
}

function truncateLine(line: string): string {
	if (line.length <= DETAIL_LINE_MAX_LENGTH) {
		return line;
	}
	return `${line.substring(0, DETAIL_LINE_MAX_LENGTH)}...`;
}

function formatPayloadLines(
	payload: unknown,
	indent: string,
	verbose: boolean,
	lineCount: { current: number },
): string[] {
	if (!payload || typeof payload !== "object") {
		lineCount.current++;
		return [`${indent}${String(payload)}`];
	}

	const lines: string[] = [];
	for (const [key, value] of Object.entries(payload)) {
		if (!verbose && lineCount.current >= 2) {
			return lines;
		}
		if (value === null || value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			if (value.length === 0) {
				lines.push(`${indent}${key}: []`);
				lineCount.current++;
			} else if (typeof value[0] === "object") {
				lines.push(`${indent}${key}: [${value.length} items]`);
				lineCount.current++;
				if (verbose) {
					value.forEach((item, idx) => {
						lines.push(`${indent}  [${idx}]:`);
						lineCount.current++;
						lines.push(...formatPayloadLines(item, `${indent}    `, verbose, lineCount));
					});
				}
			} else {
				lines.push(`${indent}${key}: [${value.join(", ")}]`);
				lineCount.current++;
			}
		} else if (typeof value === "object") {
			lines.push(`${indent}${key}:`);
			lineCount.current++;
			if (verbose || lineCount.current < 2) {
				lines.push(...formatPayloadLines(value, `${indent}  `, verbose, lineCount));
			}
		} else if (typeof value === "string") {
			const truncated = value.length > 100 ? `${value.substring(0, 100)}...` : value;
			lines.push(`${indent}${key}: ${truncated}`);
			lineCount.current++;
		} else {
			lines.push(`${indent}${key}: ${String(value)}`);
			lineCount.current++;
		}
	}

	return lines.map((line) => truncateLine(line));
}

function maskSensitiveData(payload: unknown): unknown {
	if (payload === null || payload === undefined) {
		return payload;
	}
	if (typeof payload !== "object") {
		return payload;
	}
	if (Array.isArray(payload)) {
		return payload.map((item) => maskSensitiveData(item));
	}
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		if (typeof key === "string" && key.toLowerCase().includes("token")) {
			if (typeof value === "string") {
				result[key] = value.length > 8 ? `${value.substring(0, 8)}...` : value;
			} else {
				result[key] = value;
			}
		} else {
			result[key] = maskSensitiveData(value);
		}
	}
	return result;
}

function getServerSummary(message: ServerMessage): string {
	switch (message.type) {
		case "welcome": {
			const p = message.payload;
			return `welcome (version: ${p.version}, tick_rate: ${p.tick_rate}s, current_tick: ${p.current_tick})`;
		}
		case "registered": {
			const p = message.payload;
			const masked = maskSensitiveData({ token: p.token }) as { token: string };
			return `registered (player_id: ${p.player_id}, token: ${masked.token})`;
		}
		case "logged_in": {
			const p = message.payload;
			return `logged_in (player: ${p.player.username}, empire: ${p.player.empire}, location: ${p.system.name} > ${p.poi.name})`;
		}
		case "state_update": {
			const p = message.payload;
			const docked = p.player.docked_at_base ? " (docked)" : "";
			return `state_update (tick: ${p.tick}, player: ${p.player.username}, credits: ${p.player.credits}, location: ${p.player.current_system} > ${p.player.current_poi}${docked})`;
		}
		case "tick": {
			return `tick (${message.payload.tick})`;
		}
		case "ok": {
			const payload = message.payload;
			if (!payload || Object.keys(payload).length === 0) {
				return "ok";
			}
			return `ok (${formatPayload(maskSensitiveData(payload), SUMMARY_MAX_LENGTH)})`;
		}
		case "error": {
			return `error (code: ${message.payload.code})`;
		}
		case "chat_message": {
			const p = message.payload;
			return `chat_message (channel: ${p.channel}, from: ${p.sender})`;
		}
		case "combat_update": {
			const p = message.payload;
			const damageType = p.damage_type ? ` ${p.damage_type}` : "";
			return `combat_update (tick: ${p.tick}, attacker: ${p.attacker}, target: ${p.target}, damage: ${p.damage}${damageType})`;
		}
		case "player_died": {
			const p = message.payload;
			return `player_died (killed_by: ${p.killer_name || "environment"})`;
		}
		case "mining_yield": {
			const p = message.payload;
			return `mining_yield (resource: ${p.resource_id}, quantity: ${p.quantity})`;
		}
		case "scan_result": {
			const p = message.payload;
			return `scan_result (target: ${p.target_id}, success: ${p.success})`;
		}
		case "trade_offer_received": {
			const p = message.payload;
			return `trade_offer_received (trade_id: ${p.trade_id}, from: ${p.from_name})`;
		}
		default: {
			const fallback = message as { type: string; payload?: unknown };
			const payload = fallback.payload;
			if (!payload) {
				return fallback.type;
			}
			return `${fallback.type} (${formatPayload(maskSensitiveData(payload), SUMMARY_MAX_LENGTH)})`;
		}
	}
}

function getServerDetails(message: ServerMessage, verbose: boolean): unknown {
	switch (message.type) {
		case "welcome": {
			const p = message.payload;
			return maskSensitiveData({
				version: p.version,
				release_date: p.release_date,
				tick_rate: p.tick_rate,
				current_tick: p.current_tick,
				server_time: p.server_time,
				website: p.website,
				motd: p.motd,
				release_notes: verbose ? p.release_notes : p.release_notes?.length || 0,
			});
		}
		case "registered": {
			const p = message.payload;
			return maskSensitiveData({
				player_id: p.player_id,
				token: p.token,
			});
		}
		case "logged_in": {
			const p = message.payload;
			if (!verbose) {
				return maskSensitiveData({
					player: {
						username: p.player.username,
						empire: p.player.empire,
						credits: p.player.credits,
					},
					location: {
						system: p.system.name,
						poi: p.poi.name,
					},
					ship: {
						name: p.ship.name,
						class_id: p.ship.class_id,
						hull: p.ship.hull,
						max_hull: p.ship.max_hull,
						shield: p.ship.shield,
						max_shield: p.ship.max_shield,
						fuel: p.ship.fuel,
						max_fuel: p.ship.max_fuel,
					},
				});
			}
			return maskSensitiveData({
				player: {
					username: p.player.username,
					empire: p.player.empire,
					credits: p.player.credits,
					home_base: p.player.home_base,
					docked_at_base: p.player.docked_at_base,
					status_message: p.player.status_message,
					clan_tag: p.player.clan_tag,
					faction_id: p.player.faction_id,
					faction_rank: p.player.faction_rank,
				},
				system: {
					name: p.system.name,
					empire: p.system.empire,
					police_level: p.system.police_level,
					connections: p.system.connections,
				},
				poi: {
					name: p.poi.name,
					type: p.poi.type,
					base_id: p.poi.base_id,
					resources: p.poi.resources,
				},
				ship: {
					name: p.ship.name,
					class_id: p.ship.class_id,
					hull: p.ship.hull,
					max_hull: p.ship.max_hull,
					shield: p.ship.shield,
					max_shield: p.ship.max_shield,
					fuel: p.ship.fuel,
					max_fuel: p.ship.max_fuel,
					cargo_used: p.ship.cargo_used,
					cargo_capacity: p.ship.cargo_capacity,
					modules: p.ship.modules,
				},
			});
		}
		case "state_update": {
			const p = message.payload;
			const travel =
				p.travel_progress !== undefined
					? {
							progress: Math.round(p.travel_progress * 100),
							type: p.travel_type,
							destination: p.travel_destination,
							arrival_tick: p.travel_arrival_tick,
						}
					: null;
			if (!verbose) {
				return maskSensitiveData({
					nearby_count: p.nearby?.length || 0,
					in_combat: p.in_combat,
					travel,
				});
			}
			return maskSensitiveData({
				tick: p.tick,
				player: {
					username: p.player.username,
					credits: p.player.credits,
					current_system: p.player.current_system,
					current_poi: p.player.current_poi,
					docked_at_base: p.player.docked_at_base,
					status_message: p.player.status_message,
				},
				ship: {
					hull: p.ship.hull,
					max_hull: p.ship.max_hull,
					shield: p.ship.shield,
					max_shield: p.ship.max_shield,
					fuel: p.ship.fuel,
					max_fuel: p.ship.max_fuel,
					cargo_used: p.ship.cargo_used,
					cargo_capacity: p.ship.cargo_capacity,
				},
				nearby_count: p.nearby?.length || 0,
				in_combat: p.in_combat,
				travel,
			});
		}
		case "error": {
			return maskSensitiveData(message.payload);
		}
		case "chat_message": {
			const p = message.payload;
			return maskSensitiveData({
				channel: p.channel,
				sender: p.sender,
				sender_id: p.sender_id,
				message: p.content,
				timestamp: p.timestamp,
			});
		}
		case "combat_update": {
			return maskSensitiveData(message.payload);
		}
		case "player_died": {
			return maskSensitiveData(message.payload);
		}
		case "mining_yield": {
			return maskSensitiveData(message.payload);
		}
		case "scan_result": {
			return maskSensitiveData(message.payload);
		}
		case "trade_offer_received": {
			const p = message.payload;
			return maskSensitiveData({
				trade_id: p.trade_id,
				from_player: p.from_player,
				from_name: p.from_name,
				offer_items: verbose ? p.offer_items : p.offer_items?.length || 0,
				offer_credits: p.offer_credits,
				request_items: verbose ? p.request_items : p.request_items?.length || 0,
				request_credits: p.request_credits,
			});
		}
		case "ok": {
			return maskSensitiveData(message.payload);
		}
		case "tick": {
			return undefined;
		}
		default: {
			return maskSensitiveData((message as { payload?: unknown }).payload);
		}
	}
}

export function formatPayload(payload: unknown, maxLength = SUMMARY_MAX_LENGTH): string {
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

	const joined = parts.join(", ");
	return joined.length > maxLength ? `${joined.substring(0, maxLength)}...` : joined;
}
