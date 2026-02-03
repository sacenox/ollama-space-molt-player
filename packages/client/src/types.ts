export type Empire = "solarian" | "voidborn" | "crimson" | "nebula" | "outerrim";

export interface Instance {
	instance_id: string;
	hint: string | null;
	logged_out: number;
}

export interface Username {
	id: number;
	username: string;
	token: string;
	prompt: string;
	player_id: string;
	instance_id: string;
	last_used_on: number;
}

export interface AccountDetails {
	username: string;
	token: string;
	player_id: string;
	prompt: string;
	hint: string | null;
}

export type MessageSender = "server" | "client";

export interface StoredMessage {
	id: number;
	tick: number;
	sender: MessageSender;
	data: string;
}

export interface ClientConfig {
	instanceId?: string;
	hint?: string;
	model?: string;
	verbose?: boolean;
	archetype?: string;
	tickRate: number;
	ollamaTimeout: number;
	serverUrl?: string;
	contextWindowSize?: number;
}
