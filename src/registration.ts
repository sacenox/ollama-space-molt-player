import type { SpaceMoltClient } from "../client/src/client";
import type { EmpireID } from "../client/src/types";
import { PERSONALITY_ARCHETYPES } from "./constants";
import type { OllamaAgent } from "./ollama";
import { buildRegistrationPrompt } from "./prompt";
import { formatAiThinking, formatSystemMessage } from "./tui/formatters";
import type { Tui } from "./tui/index";
import type { RegistrationChoice } from "./types";
import { isValidEmpire, isValidPersonality } from "./utils";

export async function runRegistrationFlow(
	tui: Tui,
	ollama: OllamaAgent,
	client: SpaceMoltClient,
	failedRegistrationNames: string[],
): Promise<RegistrationChoice> {
	tui.log(
		formatSystemMessage(
			"No credentials found. Asking LLM to create a character...",
		),
	);
	let attempts = 0;
	while (attempts < 3) {
		attempts += 1;
		try {
			const prompt = buildRegistrationPrompt(true, failedRegistrationNames);
			tui.setPrompt(prompt);
			const result = await ollama.generateJson<RegistrationChoice>(prompt);
			if (result.thinking) {
				tui.log(formatAiThinking(result.thinking));
			}
			const username = String(result.json.username ?? "").trim();
			const empire = String(result.json.empire ?? "").trim() as EmpireID;
			const personality = String(
				result.json.personality ?? "",
			).trim() as typeof result.json.personality;
			const personalityReason = result.json.personality_reason
				? String(result.json.personality_reason).trim()
				: undefined;

			if (
				!username ||
				!isValidEmpire(empire) ||
				!isValidPersonality(personality)
			) {
				throw new Error("Invalid registration response");
			}

			const choice: RegistrationChoice = {
				username,
				empire,
				personality,
				personality_reason: personalityReason,
			};

			const personalityInfo = PERSONALITY_ARCHETYPES[personality];
			tui.log(
				formatSystemMessage(`Registering new account: ${username} (${empire})`),
			);
			tui.log(
				formatSystemMessage(
					`Chosen personality: ${personalityInfo.name}${personalityReason ? ` - ${personalityReason}` : ""}`,
				),
			);
			client.register(username, empire);
			return choice;
		} catch (error) {
			tui.log(
				formatSystemMessage(
					`Registration attempt failed: ${(error as Error).message}`,
				),
			);
		}
	}

	const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
	const fallbackChoice: RegistrationChoice = {
		username: fallback,
		empire: "solarian",
		personality: "pragmatist",
	};
	tui.log(
		formatSystemMessage(
			`Falling back to account: ${fallback} (solarian, pragmatist)`,
		),
	);
	client.register(fallback, "solarian");
	return fallbackChoice;
}
