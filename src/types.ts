import type { EmpireID } from "../client/src/types";

export type PersonalityType =
	| "wonderer"
	| "merchant"
	| "warrior"
	| "diplomat"
	| "pragmatist";

export interface ActionDecision {
	action: string;
	args?: Record<string, unknown>;
	goal?: string;
}

export interface Credentials {
	username: string;
	token: string;
	personality: PersonalityType;
}

export interface RegistrationChoice {
	username: string;
	empire: EmpireID;
	personality: PersonalityType;
	personality_reason?: string;
	token?: string;
}

export interface PersonalityArchetype {
	name: string;
	emoji: string;
	description: string;
}
