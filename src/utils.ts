import type { EmpireID } from "../client/src/types";
import type { StoredAction } from "./memory";
import type { PersonalityType } from "./types";

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidEmpire(empire: string): empire is EmpireID {
	return ["solarian", "voidborn", "crimson", "nebula", "outerrim"].includes(
		empire,
	);
}

export function isValidPersonality(
	personality: string,
): personality is PersonalityType {
	return ["wonderer", "merchant", "warrior", "diplomat", "pragmatist"].includes(
		personality,
	);
}

export function isNearbyTarget(
	nearby: { player_id?: string; username?: string }[] | undefined,
	targetId: unknown,
): boolean {
	if (!nearby || nearby.length === 0) return false;
	const target = String(targetId ?? "").trim();
	if (!target) return false;
	const normalized = target.toLowerCase();
	return nearby.some((player) => {
		const id = player.player_id ? player.player_id.toLowerCase() : "";
		const name = player.username ? player.username.toLowerCase() : "";
		return normalized === id || normalized === name;
	});
}

export function detectRepetition(
	actions: StoredAction[],
	threshold: number,
): { action: string; count: number } | null {
	if (actions.length < threshold) return null;
	const recent = actions.slice(-threshold);
	const key = (a: StoredAction) => `${a.action}:${a.args ?? ""}`;
	const firstKey = key(recent[0]);
	if (recent.every((a) => key(a) === firstKey)) {
		return { action: recent[0].action, count: threshold };
	}
	return null;
}
