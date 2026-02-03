/**
 * Core logging functionality for console output.
 */

import type { LogContext, LogDirection, LogLevel, ToolResult } from "./types.ts";
import {
	formatDetailLines,
	formatThinking,
	maskSensitiveData,
	normalizeErrorDetails,
} from "./formatter.ts";

const useColor = !process.env.NO_COLOR && process.env.TERM !== "dumb";

export const ANSI = {
	reset: useColor ? "\x1b[0m" : "",
	dim: useColor ? "\x1b[90m" : "",
	cyan: useColor ? "\x1b[36m" : "",
	green: useColor ? "\x1b[32m" : "",
	yellow: useColor ? "\x1b[33m" : "",
	red: useColor ? "\x1b[31m" : "",
	magenta: useColor ? "\x1b[35m" : "",
	blue: useColor ? "\x1b[34m" : "",
	bold: useColor ? "\x1b[1m" : "",
} as const;

function getColor(direction: LogDirection, level: LogLevel): string {
	if (level === "error") return ANSI.red;
	if (level === "warn") return ANSI.yellow;
	return direction === "in" ? ANSI.cyan : ANSI.green;
}

/**
 * Core log function with direction and level.
 */
export function log(
	context: LogContext,
	direction: LogDirection,
	summary: string,
	details?: unknown,
	level: LogLevel = "info",
): void {
	const identifier = context.username || context.instanceId;
	const arrow = direction === "in" ? "←" : "→";
	const color = getColor(direction, level);
	const header = `${color}[${identifier}] ${arrow} ${summary}${ANSI.reset}`;
	const lines = formatDetailLines(details, context.verbose);
	const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
	logger(header);
	if (lines.length > 0) {
		lines.forEach((line) => logger(`${ANSI.dim}  ${line}${ANSI.reset}`));
	}
	logger("");
}

/**
 * Log a client event (outbound direction).
 */
export function logClientEvent(context: LogContext, message: string, details?: unknown): void {
	log(context, "out", message, details);
}

/**
 * Log a client warning (outbound direction).
 */
export function logClientWarning(context: LogContext, message: string, details?: unknown): void {
	log(context, "out", message, details, "warn");
}

/**
 * Log a client error (outbound direction).
 */
export function logClientError(context: LogContext, message: string, details?: unknown): void {
	const normalized = normalizeErrorDetails(details);
	log(context, "out", message, normalized, "error");
}

/**
 * Log LLM thinking process.
 */
export function logThinking(context: LogContext, thinking: string): void {
	const formatted = formatThinking(thinking, context.verbose);
	log(context, "out", "thinking", formatted);
}

/**
 * Log a tool call (outbound direction).
 */
export function logToolCall(
	context: LogContext,
	toolName: string,
	args: Record<string, unknown>,
): void {
	const maskedArgs = maskSensitiveData(args);
	log(context, "out", `tool call: ${toolName}`, maskedArgs);
}

/**
 * Log a tool result with optional comparison between raw server data and LLM context.
 * 
 * When `result.summarized` is provided, shows both:
 * - SERVER DATA: What the server returned (raw)
 * - LLM CONTEXT: What the LLM sees (summarized)
 */
export function logToolResult(
	context: LogContext,
	toolName: string,
	result: ToolResult,
): void {
	const level = result.success ? "info" : "warn";
	const summary = result.success ? `tool result: ${toolName}` : `tool error: ${toolName}`;

	// If no summarized data, use original behavior
	if (result.summarized === undefined) {
		const details = result.success
			? result.content
			: { error: result.error, content: result.content };
		log(context, "in", summary, maskSensitiveData(details), level);
		return;
	}

	// Show comparison: server data vs LLM context
	logToolResultComparison(context, toolName, result);
}

/**
 * Log tool result with side-by-side comparison of server data vs LLM context.
 */
function logToolResultComparison(
	context: LogContext,
	toolName: string,
	result: ToolResult,
): void {
	const identifier = context.username || context.instanceId;
	const level = result.success ? "info" : "warn";
	const color = level === "warn" ? ANSI.yellow : ANSI.cyan;
	const statusLabel = result.success ? "tool result" : "tool error";
	const logger = level === "warn" ? console.warn : console.log;

	// Header
	const header = `${color}[${identifier}] ← ${statusLabel}: ${toolName}${ANSI.reset}`;
	logger(header);

	// For errors, show full error details
	if (!result.success) {
		const errorDetails = { error: result.error, content: result.content };
		const lines = formatDetailLines(maskSensitiveData(errorDetails), context.verbose);
		lines.forEach((line) => logger(`${ANSI.dim}  ${line}${ANSI.reset}`));
		logger("");
		return;
	}

	// Server data section
	logger(`${ANSI.blue}  SERVER DATA (raw):${ANSI.reset}`);
	const serverLines = formatDetailLines(maskSensitiveData(result.content), context.verbose);
	serverLines.forEach((line) => logger(`${ANSI.dim}    ${line}${ANSI.reset}`));

	// LLM context section
	logger(`${ANSI.magenta}  LLM CONTEXT (summarized):${ANSI.reset}`);
	const llmLines = formatDetailLines(maskSensitiveData(result.summarized), context.verbose);
	llmLines.forEach((line) => logger(`${ANSI.dim}    ${line}${ANSI.reset}`));

	logger("");
}
