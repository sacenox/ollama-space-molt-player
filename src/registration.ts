import type { SpaceMoltClient } from "../client/src/client";
import type { EmpireID } from "../client/src/types";
import {
	ALIGNMENT_DESCRIPTIONS,
	PERSONALITY_ARCHETYPES,
	SPEECH_STYLE_DESCRIPTIONS,
} from "./constants";
import type { OllamaAgent } from "./ollama";
import type { OutputInterface } from "./output-interface";
import { formatSystemMessage } from "./tui/formatters";
import type {
	AlignmentResponse,
	AlignmentType,
	EmpireResponse,
	PartialRegistrationChoice,
	PersonalityResponse,
	RegistrationChoice,
	RegistrationContext,
	RegistrationOverrides,
	SpeechStyleResponse,
	SpeechStyleType,
	UsernameResponse,
} from "./types";
import { isValidAlignment, isValidEmpire, isValidSpeechStyle } from "./utils";

function shuffleArray<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

async function promptForPersonality(
	ollama: OllamaAgent,
	output: OutputInterface,
	partial: PartialRegistrationChoice,
): Promise<PersonalityResponse> {
	let attempts = 0;
	let lastError: string | null = null;

	while (attempts < 3) {
		attempts++;
		const prompt = buildPersonalityPrompt(partial, lastError);
		output.setPrompt(prompt);
		output.logDebug("REGISTRATION_PERSONALITY_PROMPT", prompt);

		try {
			const result = await ollama.generateJson<PersonalityResponse>(prompt);
			output.logDebug("REGISTRATION_PERSONALITY_RAW", result.raw);
			if (result.thinking) {
				output.logDebug("REGISTRATION_PERSONALITY_THINKING", result.thinking);
			}

			const title = String(result.json.title ?? "").trim();
			const behavior = String(result.json.behavior ?? "").trim();

			if (!title || !behavior) {
				throw new Error("Missing title or behavior");
			}

			if (title.length > 50) {
				throw new Error("Title too long (max 50 chars)");
			}

			if (behavior.length > 200) {
				throw new Error("Behavior too long (max 200 chars)");
			}

			return { title, behavior };
		} catch (error) {
			lastError = (error as Error).message;
			output.log(
				formatSystemMessage(
					`Personality prompt failed (attempt ${attempts}/3): ${lastError}`,
				),
			);
		}
	}

	throw new Error("Failed to get valid personality after 3 attempts");
}

async function promptForSpeechStyle(
	ollama: OllamaAgent,
	output: OutputInterface,
	partial: PartialRegistrationChoice,
): Promise<SpeechStyleType> {
	let attempts = 0;
	let lastError: string | null = null;

	while (attempts < 3) {
		attempts++;
		const prompt = buildSpeechStylePrompt(partial, lastError);
		output.setPrompt(prompt);
		output.logDebug("REGISTRATION_SPEECH_STYLE_PROMPT", prompt);

		try {
			const result = await ollama.generateJson<SpeechStyleResponse>(prompt);
			output.logDebug("REGISTRATION_SPEECH_STYLE_RAW", result.raw);
			if (result.thinking) {
				output.logDebug("REGISTRATION_SPEECH_STYLE_THINKING", result.thinking);
			}

			const speechStyle = String(result.json.speech_style ?? "").trim();

			if (!isValidSpeechStyle(speechStyle)) {
				throw new Error(
					`Invalid speech style: ${speechStyle}. Must be one of: mythic, punny, gritty, scholarly`,
				);
			}

			return speechStyle;
		} catch (error) {
			lastError = (error as Error).message;
			output.log(
				formatSystemMessage(
					`Speech style prompt failed (attempt ${attempts}/3): ${lastError}`,
				),
			);
		}
	}

	throw new Error("Failed to get valid speech style after 3 attempts");
}

async function promptForEmpire(
	ollama: OllamaAgent,
	output: OutputInterface,
	partial: PartialRegistrationChoice,
	serverError?: string,
): Promise<EmpireID> {
	let attempts = 0;
	let lastError: string | null = serverError ?? null;

	while (attempts < 3) {
		attempts++;
		const prompt = buildEmpirePrompt(partial, lastError);
		output.setPrompt(prompt);
		output.logDebug("REGISTRATION_EMPIRE_PROMPT", prompt);

		try {
			const result = await ollama.generateJson<EmpireResponse>(prompt);
			output.logDebug("REGISTRATION_EMPIRE_RAW", result.raw);
			if (result.thinking) {
				output.logDebug("REGISTRATION_EMPIRE_THINKING", result.thinking);
			}

			const empire = String(result.json.empire ?? "").trim() as EmpireID;

			if (!isValidEmpire(empire)) {
				throw new Error(
					`Invalid empire: ${empire}. Must be one of: solarian, voidborn, crimson, nebula, outerrim`,
				);
			}

			return empire;
		} catch (error) {
			lastError = (error as Error).message;
			output.log(
				formatSystemMessage(
					`Empire prompt failed (attempt ${attempts}/3): ${lastError}`,
				),
			);
		}
	}

	throw new Error("Failed to get valid empire after 3 attempts");
}

async function promptForAlignment(
	ollama: OllamaAgent,
	output: OutputInterface,
	partial: PartialRegistrationChoice,
): Promise<AlignmentType> {
	let attempts = 0;
	let lastError: string | null = null;

	while (attempts < 3) {
		attempts++;
		const prompt = buildAlignmentPrompt(partial, lastError);
		output.setPrompt(prompt);
		output.logDebug("REGISTRATION_ALIGNMENT_PROMPT", prompt);

		try {
			const result = await ollama.generateJson<AlignmentResponse>(prompt);
			output.logDebug("REGISTRATION_ALIGNMENT_RAW", result.raw);
			if (result.thinking) {
				output.logDebug("REGISTRATION_ALIGNMENT_THINKING", result.thinking);
			}

			const alignment = String(result.json.alignment ?? "").trim();

			if (!isValidAlignment(alignment)) {
				throw new Error(
					`Invalid alignment: ${alignment}. Must be one of: lawful, good, neutral, chaotic, evil`,
				);
			}

			return alignment;
		} catch (error) {
			lastError = (error as Error).message;
			output.log(
				formatSystemMessage(
					`Alignment prompt failed (attempt ${attempts}/3): ${lastError}`,
				),
			);
		}
	}

	throw new Error("Failed to get valid alignment after 3 attempts");
}

async function promptForUsername(
	ollama: OllamaAgent,
	output: OutputInterface,
	partial: PartialRegistrationChoice,
	failedNames: string[],
	serverError?: string,
): Promise<string> {
	let attempts = 0;
	let lastError: string | null = serverError ?? null;

	while (attempts < 3) {
		attempts++;
		const prompt = buildUsernamePrompt(partial, failedNames, lastError);
		output.setPrompt(prompt);
		output.logDebug("REGISTRATION_USERNAME_PROMPT", prompt);

		try {
			const result = await ollama.generateJson<UsernameResponse>(prompt);
			output.logDebug("REGISTRATION_USERNAME_RAW", result.raw);
			if (result.thinking) {
				output.logDebug("REGISTRATION_USERNAME_THINKING", result.thinking);
			}

			const username = String(result.json.username ?? "").trim();

			if (!username) {
				throw new Error("Username is required");
			}

			if (username.length < 3 || username.length > 32) {
				throw new Error("Username must be 3-32 characters");
			}

			if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
				throw new Error(
					"Username must contain only alphanumeric characters, underscores, or hyphens",
				);
			}

			if (failedNames.includes(username)) {
				throw new Error(
					`Username "${username}" was already rejected. Choose a different one.`,
				);
			}

			return username;
		} catch (error) {
			lastError = (error as Error).message;
			output.log(
				formatSystemMessage(
					`Username prompt failed (attempt ${attempts}/3): ${lastError}`,
				),
			);
		}
	}

	throw new Error("Failed to get valid username after 3 attempts");
}

function buildPersonalityPrompt(
	partial: PartialRegistrationChoice,
	lastError: string | null,
): string {
	const archetypes = shuffleArray(Object.entries(PERSONALITY_ARCHETYPES));
	const examples = archetypes
		.map(([_key, info]) => `  ${info.name}: ${info.description}`)
		.join("\n");

	const errorBlock = lastError
		? `\nPREVIOUS ERROR: ${lastError}\nPlease provide a valid response.\n`
		: "";

	return `Create a personality for your SpaceMolt character.

Provide a custom title and behavior description.

Example archetypes (for reference only - you can create your own or choose one):
${examples}
${errorBlock}
Respond ONLY with JSON. No extra text.

JSON SCHEMA:
{"title":"...","behavior":"..."}

Rules:
- title: max 50 characters
- behavior: max 200 characters`;
}

function buildSpeechStylePrompt(
	partial: PartialRegistrationChoice,
	lastError: string | null,
): string {
	const styles = shuffleArray(Object.entries(SPEECH_STYLE_DESCRIPTIONS));
	const descriptions = styles
		.map(([key, info]) => `  ${info.name} (${key}): ${info.description}`)
		.join("\n");
	const styleKeys = styles.map(([key]) => key).join("|");

	const priorChoices = partial.personality
		? `\nYour personality: ${partial.personality.title}\n${partial.personality.behavior}\n`
		: "";

	const errorBlock = lastError
		? `\nPREVIOUS ERROR: ${lastError}\nPlease provide a valid response.\n`
		: "";

	return `Choose a speech style for your SpaceMolt character.
${priorChoices}
SPEECH STYLES:
${descriptions}
${errorBlock}
Respond ONLY with JSON. No extra text.

JSON SCHEMA:
{"speech_style":"${styleKeys}"}`;
}

function buildEmpirePrompt(
	partial: PartialRegistrationChoice,
	lastError: string | null,
): string {
	const empireDescriptions: Record<
		string,
		{ name: string; description: string }
	> = {
		solarian: {
			name: "Solarian",
			description:
				"Masters of energy and trade. Bonus to mining yield and credits.",
		},
		voidborn: {
			name: "Voidborn",
			description:
				"Children of the dark. Enhanced stealth and shield regeneration.",
		},
		crimson: {
			name: "Crimson",
			description:
				"Warriors of the red nebula. Superior combat damage and armor.",
		},
		nebula: {
			name: "Nebula",
			description:
				"Explorers and scientists. Faster travel and discovery bonuses.",
		},
		outerrim: {
			name: "Outer Rim",
			description:
				"Frontier survivors. Versatile with crafting and cargo bonuses.",
		},
	};

	const empires = shuffleArray(Object.entries(empireDescriptions));
	const descriptions = empires
		.map(([key, info]) => `  ${info.name} (${key}): ${info.description}`)
		.join("\n");
	const empireKeys = empires.map(([key]) => key).join("|");

	const priorChoices: string[] = [];
	if (partial.personality) {
		priorChoices.push(
			`Personality: ${partial.personality.title} - ${partial.personality.behavior}`,
		);
	}
	if (partial.speech_style) {
		const styleInfo = SPEECH_STYLE_DESCRIPTIONS[partial.speech_style];
		priorChoices.push(`Speech Style: ${styleInfo.name}`);
	}
	const priorBlock =
		priorChoices.length > 0
			? `\nYour choices:\n${priorChoices.join("\n")}\n`
			: "";

	const errorBlock = lastError
		? `\nPREVIOUS ERROR: ${lastError}\nPlease provide a valid response.\n`
		: "";

	return `Choose an empire for your SpaceMolt character.
${priorBlock}
EMPIRES:
${descriptions}
${errorBlock}
Respond ONLY with JSON. No extra text.

JSON SCHEMA:
{"empire":"${empireKeys}"}`;
}

function buildAlignmentPrompt(
	partial: PartialRegistrationChoice,
	lastError: string | null,
): string {
	const alignments = shuffleArray(Object.entries(ALIGNMENT_DESCRIPTIONS));
	const descriptions = alignments
		.map(([key, info]) => `  ${info.name} (${key}): ${info.description}`)
		.join("\n");
	const alignmentKeys = alignments.map(([key]) => key).join("|");

	const priorChoices: string[] = [];
	if (partial.personality) {
		priorChoices.push(
			`Personality: ${partial.personality.title} - ${partial.personality.behavior}`,
		);
	}
	if (partial.speech_style) {
		const styleInfo = SPEECH_STYLE_DESCRIPTIONS[partial.speech_style];
		priorChoices.push(`Speech Style: ${styleInfo.name}`);
	}
	if (partial.empire) {
		priorChoices.push(`Empire: ${partial.empire}`);
	}
	const priorBlock =
		priorChoices.length > 0
			? `\nYour choices:\n${priorChoices.join("\n")}\n`
			: "";

	const errorBlock = lastError
		? `\nPREVIOUS ERROR: ${lastError}\nPlease provide a valid response.\n`
		: "";

	return `Choose an alignment for your SpaceMolt character.
${priorBlock}
ALIGNMENTS:
${descriptions}
${errorBlock}
Respond ONLY with JSON. No extra text.

JSON SCHEMA:
{"alignment":"${alignmentKeys}"}`;
}

function buildUsernamePrompt(
	partial: PartialRegistrationChoice,
	failedNames: string[],
	lastError: string | null,
): string {
	const priorChoices: string[] = [];
	if (partial.personality) {
		priorChoices.push(
			`Personality: ${partial.personality.title} - ${partial.personality.behavior}`,
		);
	}
	if (partial.speech_style) {
		const styleInfo = SPEECH_STYLE_DESCRIPTIONS[partial.speech_style];
		priorChoices.push(`Speech Style: ${styleInfo.name}`);
	}
	if (partial.empire) {
		priorChoices.push(`Empire: ${partial.empire}`);
	}
	if (partial.alignment) {
		const alignmentInfo = ALIGNMENT_DESCRIPTIONS[partial.alignment];
		priorChoices.push(`Alignment: ${alignmentInfo.name}`);
	}
	const priorBlock =
		priorChoices.length > 0
			? `\nYour choices:\n${priorChoices.join("\n")}\n`
			: "";

	const failedBlock =
		failedNames.length > 0
			? `\nPreviously rejected usernames (do NOT reuse): ${failedNames.join(", ")}\n`
			: "";

	const errorBlock = lastError
		? `\nPREVIOUS ERROR: ${lastError}\nPlease provide a valid response.\n`
		: "";

	return `Choose a username for your SpaceMolt character.
${priorBlock}${failedBlock}
The username MUST be unique and original. Do not reuse any prior suggestions.
To maximize uniqueness, include a distinctive suffix (digits or a short tag).
${errorBlock}
Respond ONLY with JSON. No extra text.

JSON SCHEMA:
{"username":"..."}

Rules:
- username: 3-32 characters, alphanumeric with underscores/hyphens allowed`;
}

export async function runRegistrationFlow(
	output: OutputInterface,
	ollama: OllamaAgent,
	client: SpaceMoltClient,
	context: RegistrationContext,
	overrides: RegistrationOverrides = {},
): Promise<RegistrationChoice> {
	const isRetry = !!(context.empireError || context.usernameError);

	if (isRetry) {
		output.log(
			formatSystemMessage(
				"Server rejected registration. Re-prompting with server feedback...",
			),
		);
	} else {
		output.log(
			formatSystemMessage(
				"No credentials found. Creating character through sequential prompts...",
			),
		);
	}

	try {
		const partial: PartialRegistrationChoice = context.priorChoices ?? {};

		// Step 1: Personality (unless overridden or already chosen)
		if (overrides.personality_title && overrides.personality_behavior) {
			output.log(
				formatSystemMessage(
					`Using override personality: ${overrides.personality_title}`,
				),
			);
			partial.personality = {
				title: overrides.personality_title,
				behavior: overrides.personality_behavior,
			};
		} else if (!partial.personality) {
			output.log(formatSystemMessage("Step 1/5: Choosing personality..."));
			partial.personality = await promptForPersonality(ollama, output, partial);
			output.log(
				formatSystemMessage(`Personality chosen: ${partial.personality.title}`),
			);
		} else {
			output.log(
				formatSystemMessage(
					`Using prior personality: ${partial.personality.title}`,
				),
			);
		}

		// Step 2: Speech Style (unless overridden or already chosen)
		if (overrides.speech_style) {
			output.log(
				formatSystemMessage(
					`Using override speech style: ${SPEECH_STYLE_DESCRIPTIONS[overrides.speech_style].name}`,
				),
			);
			partial.speech_style = overrides.speech_style;
		} else if (!partial.speech_style) {
			output.log(formatSystemMessage("Step 2/5: Choosing speech style..."));
			partial.speech_style = await promptForSpeechStyle(
				ollama,
				output,
				partial,
			);
			output.log(
				formatSystemMessage(
					`Speech style chosen: ${SPEECH_STYLE_DESCRIPTIONS[partial.speech_style].name}`,
				),
			);
		} else {
			output.log(
				formatSystemMessage(
					`Using prior speech style: ${SPEECH_STYLE_DESCRIPTIONS[partial.speech_style].name}`,
				),
			);
		}

		// Step 3: Empire (unless overridden or already chosen and no error)
		if (overrides.empire) {
			output.log(
				formatSystemMessage(`Using override empire: ${overrides.empire}`),
			);
			partial.empire = overrides.empire;
		} else if (!partial.empire || context.empireError) {
			output.log(formatSystemMessage("Step 3/5: Choosing empire..."));
			partial.empire = await promptForEmpire(
				ollama,
				output,
				partial,
				context.empireError,
			);
			output.log(formatSystemMessage(`Empire chosen: ${partial.empire}`));
		} else {
			output.log(formatSystemMessage(`Using prior empire: ${partial.empire}`));
		}

		// Step 4: Alignment (unless overridden or already chosen)
		if (overrides.alignment) {
			output.log(
				formatSystemMessage(
					`Using override alignment: ${ALIGNMENT_DESCRIPTIONS[overrides.alignment].name}`,
				),
			);
			partial.alignment = overrides.alignment;
		} else if (!partial.alignment) {
			output.log(formatSystemMessage("Step 4/5: Choosing alignment..."));
			partial.alignment = await promptForAlignment(ollama, output, partial);
			output.log(
				formatSystemMessage(
					`Alignment chosen: ${ALIGNMENT_DESCRIPTIONS[partial.alignment].name}`,
				),
			);
		} else {
			output.log(
				formatSystemMessage(
					`Using prior alignment: ${ALIGNMENT_DESCRIPTIONS[partial.alignment].name}`,
				),
			);
		}

		// Step 5: Username (always prompt if missing or error)
		if (!partial.username || context.usernameError) {
			output.log(formatSystemMessage("Step 5/5: Choosing username..."));
			partial.username = await promptForUsername(
				ollama,
				output,
				partial,
				context.failedNames,
				context.usernameError,
			);
			output.log(formatSystemMessage(`Username chosen: ${partial.username}`));
		} else {
			output.log(
				formatSystemMessage(`Using prior username: ${partial.username}`),
			);
		}

		// Build final choice
		const choice: RegistrationChoice = {
			username: partial.username,
			empire: partial.empire,
			personality_title: partial.personality.title,
			personality_behavior: partial.personality.behavior,
			alignment: partial.alignment,
			speech_style: partial.speech_style,
		};

		// Register with client
		output.log(
			formatSystemMessage(
				`Registering new account: ${choice.username} (${choice.empire})`,
			),
		);
		output.log(
			formatSystemMessage(
				`Character: ${choice.personality_title}, ${SPEECH_STYLE_DESCRIPTIONS[choice.speech_style].name} style, ${ALIGNMENT_DESCRIPTIONS[choice.alignment].name} alignment`,
			),
		);

		client.register(choice.username, choice.empire);
		return choice;
	} catch (error) {
		output.log(
			formatSystemMessage(
				`Registration flow failed: ${(error as Error).message}`,
			),
		);

		// Fallback to random defaults
		const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
		const fallbackEmpire = overrides.empire ?? "solarian";
		const fallbackAlignment = overrides.alignment ?? "neutral";
		const fallbackPersonalityTitle =
			overrides.personality_title ?? "Pragmatist";
		const fallbackPersonalityBehavior =
			overrides.personality_behavior ??
			"Resourceful survivor who seizes every opportunity, pivots between roles, and thrives where others struggle.";
		const fallbackSpeechStyle = overrides.speech_style ?? "mythic";

		const fallbackChoice: RegistrationChoice = {
			username: fallback,
			empire: fallbackEmpire,
			alignment: fallbackAlignment,
			personality_title: fallbackPersonalityTitle,
			personality_behavior: fallbackPersonalityBehavior,
			speech_style: fallbackSpeechStyle,
		};

		output.log(
			formatSystemMessage(
				`Falling back to account: ${fallback} (${fallbackEmpire}, ${fallbackAlignment}, ${fallbackPersonalityTitle}, ${fallbackSpeechStyle})`,
			),
		);

		client.register(fallback, fallbackEmpire);
		return fallbackChoice;
	}
}
