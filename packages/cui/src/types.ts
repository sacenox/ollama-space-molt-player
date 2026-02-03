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

	summarized?: unknown;
}
