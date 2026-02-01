import type { SpaceMoltClient } from "../client/src/client";
import type { EmpireID } from "../client/src/types";
import { ALIGNMENT_DESCRIPTIONS, PERSONALITY_ARCHETYPES } from "./constants";
import type { OllamaAgent } from "./ollama";
import type { OutputInterface } from "./output-interface";
import { buildRegistrationPrompt } from "./prompt";
import { formatAiThinking, formatSystemMessage } from "./tui/formatters";
import type {
	AlignmentType,
	RegistrationChoice,
	RegistrationOverrides,
} from "./types";
import { isValidAlignment, isValidEmpire, isValidPersonality } from "./utils";

export async function runRegistrationFlow(
	output: OutputInterface,
	ollama: OllamaAgent,
	client: SpaceMoltClient,
	failedRegistrationNames: string[],
	overrides: RegistrationOverrides = {},
): Promise<RegistrationChoice> {
	output.log(
		formatSystemMessage(
			"No credentials found. Asking LLM to create a character...",
		),
	);
	let attempts = 0;
	while (attempts < 3) {
		attempts += 1;
		try {
			const prompt = buildRegistrationPrompt(true, failedRegistrationNames);
			output.setPrompt(prompt);
			output.logDebug("REGISTRATION_PROMPT", prompt);
			const result = await ollama.generateJson<RegistrationChoice>(prompt);
			output.logDebug("REGISTRATION_RESPONSE_RAW", result.raw);
			if (result.thinking) {
				output.log(formatAiThinking(result.thinking));
				output.logDebug("REGISTRATION_THINKING", result.thinking);
			}
			const username = String(result.json.username ?? "").trim();
			const empire = String(result.json.empire ?? "").trim() as EmpireID;
			const alignment = String(
				result.json.alignment ?? "neutral",
			).trim() as AlignmentType;
			const personality = String(
				result.json.personality ?? "",
			).trim() as typeof result.json.personality;
			const personalityReason = result.json.personality_reason
				? String(result.json.personality_reason).trim()
				: undefined;
			const resolvedEmpire = overrides.empire ?? empire;
			const resolvedAlignment = overrides.alignment ?? alignment;
			const resolvedPersonality = overrides.personality ?? personality;

			if (
				!username ||
				!isValidEmpire(resolvedEmpire) ||
				!isValidAlignment(resolvedAlignment) ||
				!isValidPersonality(resolvedPersonality)
			) {
				throw new Error("Invalid registration response");
			}

			const choice: RegistrationChoice = {
				username,
				empire: resolvedEmpire,
				alignment: resolvedAlignment,
				personality: resolvedPersonality,
				personality_reason: personalityReason,
			};

			const alignmentInfo = ALIGNMENT_DESCRIPTIONS[resolvedAlignment];
			const personalityInfo = PERSONALITY_ARCHETYPES[resolvedPersonality];
			output.log(
				formatSystemMessage(
					`Registering new account: ${username} (${resolvedEmpire})`,
				),
			);
			output.log(
				formatSystemMessage(
					`Chosen alignment: ${alignmentInfo.name}, personality: ${personalityInfo.name}${personalityReason ? ` - ${personalityReason}` : ""}`,
				),
			);
			client.register(username, resolvedEmpire);
			return choice;
		} catch (error) {
			output.log(
				formatSystemMessage(
					`Registration attempt failed: ${(error as Error).message}`,
				),
			);
		}
	}

	const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
	const fallbackEmpire = overrides.empire ?? "solarian";
	const fallbackAlignment = overrides.alignment ?? "neutral";
	const fallbackPersonality = overrides.personality ?? "pragmatist";
	const fallbackChoice: RegistrationChoice = {
		username: fallback,
		empire: fallbackEmpire,
		alignment: fallbackAlignment,
		personality: fallbackPersonality,
	};
	output.log(
		formatSystemMessage(
			`Falling back to account: ${fallback} (${fallbackEmpire}, ${fallbackAlignment}, ${fallbackPersonality})`,
		),
	);
	client.register(fallback, fallbackEmpire);
	return fallbackChoice;
}
