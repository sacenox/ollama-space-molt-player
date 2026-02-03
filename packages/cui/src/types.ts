/**
 * Types for the Console User Interface (CUI) package.
 */

export interface LogContext {
	tick: number;
	instanceId: string;
	username?: string | null;
	verbose: boolean;
}

export type LogDirection = "in" | "out";
export type LogLevel = "info" | "warn" | "error";

export interface ToolResult {
	success: boolean;
	content: unknown;
	error?: string;
	/** Summarized version of content (what LLM sees) */
	summarized?: unknown;
}
