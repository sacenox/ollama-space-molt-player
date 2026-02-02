import type { EmpireID } from "../client/src/types";

export type AlignmentType = "lawful" | "good" | "neutral" | "chaotic" | "evil";

export type SpeechStyleType = "mythic" | "punny" | "gritty" | "scholarly";

export interface ActionDecision {
	action: string;
	args?: Record<string, unknown>;
	mission?: string;
}

export interface Credentials {
	username: string;
	token: string;
	personality_title: string;
	personality_behavior: string;
	alignment: AlignmentType;
	speech_style: SpeechStyleType;
}

export interface PersonalityResponse {
	title: string;
	behavior: string;
}

export interface SpeechStyleResponse {
	speech_style: SpeechStyleType;
}

export interface EmpireResponse {
	empire: EmpireID;
}

export interface AlignmentResponse {
	alignment: AlignmentType;
}

export interface UsernameResponse {
	username: string;
}

export interface PartialRegistrationChoice {
	personality?: PersonalityResponse;
	speech_style?: SpeechStyleType;
	empire?: EmpireID;
	alignment?: AlignmentType;
	username?: string;
}

export interface RegistrationChoice {
	username: string;
	empire: EmpireID;
	personality_title: string;
	personality_behavior: string;
	alignment: AlignmentType;
	speech_style: SpeechStyleType;
	token?: string;
}

export interface RegistrationOverrides {
	empire?: EmpireID;
	alignment?: AlignmentType;
	personality_title?: string;
	personality_behavior?: string;
	speech_style?: SpeechStyleType;
}

export interface RegistrationContext {
	failedNames: string[];
	empireError?: string;
	usernameError?: string;
	priorChoices?: PartialRegistrationChoice;
}

export interface PersonalityArchetype {
	name: string;
	emoji: string;
	description: string;
}

export type GameStatusType =
	| "waiting_for_tick"
	| "requesting_action"
	| "llm_thinking"
	| "traveling"
	| "jumping"
	| "processing_result"
	| "in_combat"
	| "docked";

export interface ActionHistoryEntry {
	action: string;
	result: string;
	tick: number;
	timestamp: number;
}
