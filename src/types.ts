import type { EmpireID } from "../client/src/types";

export type PersonalityType =
	| "cartographer"
	| "merchant"
	| "warrior"
	| "diplomat"
	| "pragmatist";

export type AlignmentType = "lawful" | "good" | "neutral" | "chaotic" | "evil";

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
}

export interface RegistrationChoice {
	username: string;
	empire: EmpireID;
	personality: PersonalityType;
	alignment: AlignmentType;
	personality_reason?: string;
	token?: string;
}

export interface PersonalityArchetype {
	name: string;
	emoji: string;
	description: string;
}
