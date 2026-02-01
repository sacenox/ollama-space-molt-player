import type { EmpireID } from "../client/src/types";

export type PersonalityType =
	| "cartographer"
	| "merchant"
	| "warrior"
	| "diplomat"
	| "pragmatist";

export type AlignmentType = "lawful" | "good" | "neutral" | "chaotic" | "evil";

export type SpeechStyleType = "mythic" | "punny" | "gritty" | "scholarly";

export interface ActionDecision {
	action: string;
	args?: Record<string, unknown>;
	goal?: string;
}

export interface Credentials {
	username: string;
	token: string;
	personality: PersonalityType;
	alignment: AlignmentType;
	speech_style: SpeechStyleType;
}

export interface RegistrationChoice {
	username: string;
	empire: EmpireID;
	personality: PersonalityType;
	alignment: AlignmentType;
	speech_style: SpeechStyleType;
	personality_reason?: string;
	token?: string;
}

export interface RegistrationOverrides {
	empire?: EmpireID;
	alignment?: AlignmentType;
	personality?: PersonalityType;
	speech_style?: SpeechStyleType;
}

export interface PersonalityArchetype {
	name: string;
	emoji: string;
	description: string;
}
