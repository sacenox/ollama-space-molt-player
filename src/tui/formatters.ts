// Message formatting utilities - convert all events to human-readable strings

import type {
	ChatMessage,
	ErrorPayload,
	LoggedInPayload,
	RegisteredPayload,
	ScanResultPayload,
	WelcomePayload,
} from "../../client/src/types";
import { applyColor, COLORS } from "./colors";

export type LogCategory = "game" | "ai" | "combat" | "chat" | "system";

export interface OkContext {
	jumpTarget?: string | null;
	travelTarget?: string | null;
}

export interface FormattedMessage {
	text: string;
	category: LogCategory;
	timestamp: string;
	tick?: number;
}

function getTimestamp(tick?: number): string {
	const now = new Date();
	const h = String(now.getHours()).padStart(2, "0");
	const m = String(now.getMinutes()).padStart(2, "0");
	const s = String(now.getSeconds()).padStart(2, "0");
	const wallClock = `${h}:${m}:${s}`;

	if (tick !== undefined && tick >= 0) {
		return `T${tick} [${wallClock}]`;
	}
	return `[${wallClock}]`;
}

function formatWithTimestamp(
	message: string,
	category: LogCategory,
	tick?: number,
): FormattedMessage {
	const timestamp = getTimestamp(tick);
	const ts = applyColor(timestamp, COLORS.MSG_TIMESTAMP);
	return {
		text: `${ts} ${message}`,
		category,
		timestamp,
		tick,
	};
}

// Welcome message
export function formatWelcome(
	data: WelcomePayload,
	tick?: number,
): FormattedMessage {
	const msg = applyColor(
		`Connected to SpaceMolt v${data.version} (tick rate: ${data.tick_rate}s)`,
		COLORS.MSG_SUCCESS,
	);
	return formatWithTimestamp(msg, "system", tick);
}

export function formatMotd(motd: string, tick?: number): FormattedMessage {
	const msg = applyColor(`MOTD: ${motd}`, COLORS.MSG_CHAT);
	return formatWithTimestamp(msg, "system", tick);
}

// Registration
export function formatRegistered(
	_data: RegisteredPayload,
	tick?: number,
): FormattedMessage {
	const msg = applyColor(
		`Registration successful - credentials saved`,
		COLORS.MSG_SUCCESS,
	);
	return formatWithTimestamp(msg, "system", tick);
}

// Login
export function formatLoggedIn(
	data: LoggedInPayload,
	tick?: number,
): FormattedMessage {
	const msg = applyColor(
		`Logged in as ${data.player.username} (${data.player.empire})`,
		COLORS.MSG_SUCCESS,
	);
	return formatWithTimestamp(msg, "game", tick);
}

// Errors
export function formatError(
	data: ErrorPayload,
	tick?: number,
): FormattedMessage {
	const msg = applyColor(
		`Error [${data.code}]: ${data.message}`,
		COLORS.MSG_ERROR,
	);
	return formatWithTimestamp(msg, "system", tick);
}

// Chat messages
export function formatChatMessage(
	data: ChatMessage,
	tick?: number,
): FormattedMessage {
	const msg = applyColor(
		`[${data.channel}] ${data.sender}: ${data.content}`,
		COLORS.MSG_CHAT,
	);
	return formatWithTimestamp(msg, "chat", tick);
}

// Scan results
export function formatScanResult(
	data: ScanResultPayload,
	tick?: number,
): FormattedMessage {
	const parts: string[] = [];

	if (data.player) {
		parts.push(`Player: ${data.player.username || data.player.id}`);
		if (data.player.empire) parts.push(`Empire: ${data.player.empire}`);
	}

	if (data.ship) {
		parts.push(`Ship: ${data.ship.class_id || "Unknown"}`);
		if (data.ship.hull !== undefined && data.ship.max_hull !== undefined) {
			const hullPct = Math.round((data.ship.hull / data.ship.max_hull) * 100);
			parts.push(`Hull: ${hullPct}%`);
		}
		if (data.ship.shield !== undefined && data.ship.max_shield !== undefined) {
			const shieldPct = Math.round(
				(data.ship.shield / data.ship.max_shield) * 100,
			);
			parts.push(`Shield: ${shieldPct}%`);
		}
	}

	const msg = `Scan result: ${parts.join(", ")}`;
	return formatWithTimestamp(msg, "game", tick);
}

// Mining yield results
export function formatMiningYield(
	data: Record<string, unknown>,
	tick?: number,
): FormattedMessage {
	const resource = String(data.resource_id ?? "ore");
	const quantity = Number(data.quantity ?? 0);
	const msg = applyColor(`Mined ${quantity}x ${resource}`, COLORS.MSG_SUCCESS);
	return formatWithTimestamp(msg, "game", tick);
}

// OK messages - format based on action type
export function formatOk(
	data: Record<string, unknown>,
	context?: OkContext,
	tick?: number,
): FormattedMessage {
	const action = String(data.action ?? "");

	switch (action) {
		case "travel": {
			const targetId = String(
				data.target_poi ?? context?.travelTarget ?? "unknown",
			);
			const msg = applyColor(`Traveling to ${targetId}`, COLORS.MSG_SUCCESS);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "arrived": {
			const poiId = String(data.poi_id ?? "destination");
			const msg = applyColor(`Arrived at ${poiId}`, COLORS.MSG_SUCCESS);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "jump": {
			const targetSystem = String(
				data.target_system ?? context?.jumpTarget ?? "unknown",
			);
			const msg = applyColor(
				`Jumping to ${targetSystem} system`,
				COLORS.MSG_SUCCESS,
			);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "jumped": {
			const systemId = String(data.system_id ?? "new system");
			const msg = applyColor(
				`Jumped to ${systemId} system`,
				COLORS.MSG_SUCCESS,
			);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "dock": {
			const baseId = String(data.base_id ?? "base");
			const msg = applyColor(`Docked at ${baseId}`, COLORS.MSG_SUCCESS);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "undock": {
			const msg = applyColor("Undocked from base", COLORS.MSG_SUCCESS);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "mine": {
			const msg = applyColor("Mining...", COLORS.MSG_INFO);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "buy": {
			const itemId = String(data.item_id ?? "item");
			const quantity = Number(data.quantity ?? 0);
			const cost = Number(data.cost ?? 0);
			const msg = applyColor(
				`Bought ${quantity}x ${itemId} for ${cost} credits`,
				COLORS.MSG_SUCCESS,
			);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "sell": {
			const itemId = String(data.item_id ?? "item");
			const quantity = Number(data.quantity ?? 0);
			const revenue = Number(data.revenue ?? 0);
			const msg = applyColor(
				`Sold ${quantity}x ${itemId} for ${revenue} credits`,
				COLORS.MSG_SUCCESS,
			);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "repair": {
			const cost = Number(data.cost ?? 0);
			const msg = applyColor(
				`Repaired ship (cost: ${cost} credits)`,
				COLORS.MSG_SUCCESS,
			);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "refuel": {
			const cost = Number(data.cost ?? 0);
			const msg = applyColor(
				`Refueled ship (cost: ${cost} credits)`,
				COLORS.MSG_SUCCESS,
			);
			return formatWithTimestamp(msg, "game", tick);
		}

		case "attack": {
			const targetId = String(data.target_id ?? "target");
			const damage = Number(data.damage ?? 0);
			const msg = applyColor(
				`Attacked ${targetId}${damage > 0 ? ` (${damage} damage)` : ""}`,
				COLORS.STATUS_DANGER,
			);
			return formatWithTimestamp(msg, "combat", tick);
		}

		default: {
			// Generic OK message with summary
			const summary = summarizeOkPayload(data);
			const msg = `OK: ${summary}`;
			return formatWithTimestamp(msg, "game", tick);
		}
	}
}

function summarizeOkPayload(payload: Record<string, unknown>): string {
	if (Array.isArray(payload.pois) && payload.pois.length > 0) {
		const system = payload.system as { id?: string; name?: string } | undefined;
		const systemLabel =
			system?.name || system?.id ? ` for ${system?.name ?? system?.id}` : "";
		return `System${systemLabel} with ${payload.pois.length} POIs`;
	}
	if (payload.poi && typeof payload.poi === "object") {
		const poi = payload.poi as { id?: string; name?: string; type?: string };
		return `POI ${poi.name ?? poi.id ?? ""}${poi.type ? ` (${poi.type})` : ""}`.trim();
	}
	if (payload.base && typeof payload.base === "object") {
		const base = payload.base as { id?: string; name?: string };
		return `Base ${base.name ?? base.id ?? ""}`.trim();
	}
	if (payload.version) {
		return `Version ${String(payload.version)}`;
	}
	if (payload.action) {
		return String(payload.action);
	}
	return "Action completed";
}

// AI-related messages
export function formatAiThinking(
	thinking: string,
	tick?: number,
): FormattedMessage {
	const truncated =
		thinking.length > 200 ? `${thinking.slice(0, 200)}...` : thinking;
	const msg = applyColor(`[AI Thinking] ${truncated}`, COLORS.MSG_AI);
	return formatWithTimestamp(msg, "ai", tick);
}

export function formatAiAction(
	action: string,
	args?: Record<string, unknown>,
	tick?: number,
): FormattedMessage {
	const argsStr =
		args && Object.keys(args).length > 0
			? ` (${Object.entries(args)
					.map(([k, v]) => `${k}=${v}`)
					.join(", ")})`
			: "";
	const msg = applyColor(`[AI Action] ${action}${argsStr}`, COLORS.MSG_AI);
	return formatWithTimestamp(msg, "ai", tick);
}

export function formatAiMission(
	mission: string,
	tick?: number,
): FormattedMessage {
	const msg = applyColor(`[AI Mission] ${mission}`, COLORS.MSG_AI);
	return formatWithTimestamp(msg, "ai", tick);
}

// Generic system message
export function formatSystemMessage(
	message: string,
	tick?: number,
): FormattedMessage {
	return formatWithTimestamp(message, "system", tick);
}

export function formatCombatEnd(
	victory: boolean,
	tick?: number,
): FormattedMessage {
	const result = victory ? "Victory" : "Defeated";
	const msg = applyColor(`Combat ended - ${result}`, COLORS.STATUS_DANGER);
	return formatWithTimestamp(msg, "combat", tick);
}

export function formatDamageTaken(
	damage: number,
	hull: number,
	maxHull: number,
	shield: number,
	maxShield: number,
	tick?: number,
): FormattedMessage {
	const msg = applyColor(
		`Took ${damage} damage (Hull: ${hull}/${maxHull}, Shield: ${shield}/${maxShield})`,
		COLORS.STATUS_DANGER,
	);
	return formatWithTimestamp(msg, "combat", tick);
}

export function formatDamageDealt(
	damage: number,
	targetId: string,
	tick?: number,
): FormattedMessage {
	const msg = applyColor(
		`Dealt ${damage} damage to ${targetId}`,
		COLORS.STATUS_DANGER,
	);
	return formatWithTimestamp(msg, "combat", tick);
}
