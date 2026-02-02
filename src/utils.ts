import type { EmpireID } from "../client/src/types";
import type { StoredAction } from "./memory";
import type { AlignmentType, PersonalityType, SpeechStyleType } from "./types";

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidEmpire(empire: string): empire is EmpireID {
	return ["solarian", "voidborn", "crimson", "nebula", "outerrim"].includes(
		empire,
	);
}

export function isValidAlignment(
	alignment: string,
): alignment is AlignmentType {
	return ["lawful", "good", "neutral", "chaotic", "evil"].includes(alignment);
}

export function isValidPersonality(
	personality: string,
): personality is PersonalityType {
	return [
		"cartographer",
		"merchant",
		"warrior",
		"diplomat",
		"pragmatist",
	].includes(personality);
}

export function isValidSpeechStyle(
	speechStyle: string,
): speechStyle is SpeechStyleType {
	return ["mythic", "punny", "gritty", "scholarly"].includes(speechStyle);
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

export function truncateThinking(text: string, maxChars = 200): string {
	const trimmed = text.trim();

	// If short enough, return as-is
	if (trimmed.length <= maxChars) {
		return trimmed;
	}

	// Try sentence-based approach
	const sentences = trimmed.match(/[^.!?]+[.!?]+/g);

	if (sentences && sentences.length > 0) {
		// Collect sentences from end backwards
		const collected: string[] = [];
		let totalLength = 0;

		for (let i = sentences.length - 1; i >= 0; i--) {
			const sentence = sentences[i].trim();
			const newLength =
				totalLength + sentence.length + (collected.length > 0 ? 1 : 0); // +1 for space

			if (newLength > maxChars) {
				break;
			}

			collected.unshift(sentence);
			totalLength = newLength;
		}

		if (collected.length > 0) {
			const result = collected.join(" ");
			const isPartial = collected.length < sentences.length;
			return isPartial ? `[...] ${result}` : result;
		}
	}

	// Fallback: character truncation
	const excerpt = trimmed.slice(-maxChars).trim();
	return `[...] ${excerpt}`;
}
