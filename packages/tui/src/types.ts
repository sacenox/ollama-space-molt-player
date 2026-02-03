export type ClientLoopState =
	| "idle"
	| "waiting_for_tick"
	| "processing_tick"
	| "calling_llm"
	| "sending_command"
	| "error";

export interface GameState {
	currentTick: number;
	loopState: ClientLoopState;
	playerName?: string;
	playerId?: string;
	location?: string;
	shipName?: string;
	shipHealth?: number;
	shipFuel?: number;
	credits?: number;
	cargo?: Array<{ name: string; quantity: number }>;
}

export interface PlayerAction {
	tick: number;
	command: string;
	timestamp: string;
}

export interface ServerResponse {
	tick: number;
	message: string;
	type: "success" | "error" | "info";
	timestamp: string;
}

export interface ChatMessage {
	tick: number;
	channel: "system" | "local" | "faction" | "private";
	sender: string;
	message: string;
	timestamp: string;
}

export interface ForumPost {
	id: string;
	author: string;
	title: string;
	preview: string;
	replies: number;
	timestamp: string;
}

export interface ServerMessage {
	tick: number;
	category: string;
	message: string;
	timestamp: string;
}

export interface UIData {
	gameState: GameState;
	recentActions: PlayerAction[];
	recentResponses: ServerResponse[];
	chatMessages: ChatMessage[];
	forumPosts: ForumPost[];
	serverMessages: ServerMessage[];
}
