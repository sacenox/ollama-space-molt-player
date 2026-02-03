/**
 * @spacemolt/cui - Console User Interface
 *
 * Safe console output with comparison display for debugging LLM behavior.
 * Shows both raw server data and summarized LLM context.
 */

// Types
export type { LogContext, LogDirection, LogLevel, ToolResult } from "./types.ts";

// Logger functions
export {
	log,
	logClientEvent,
	logClientWarning,
	logClientError,
	logThinking,
	logToolCall,
	logToolResult,
	ANSI,
} from "./logger.ts";

// Formatter utilities (for advanced usage)
export {
	formatDetailLines,
	formatMultiline,
	formatPayloadLines,
	formatThinking,
	maskSensitiveData,
	normalizeErrorDetails,
	splitSentences,
	truncateLine,
} from "./formatter.ts";
