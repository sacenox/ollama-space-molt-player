const DETAIL_LINE_MAX_LENGTH = 300;

const useColor = !process.env.NO_COLOR && process.env.TERM !== "dumb";

const ANSI = {
	reset: useColor ? "\x1b[0m" : "",
	dim: useColor ? "\x1b[90m" : "",
	cyan: useColor ? "\x1b[36m" : "",
	green: useColor ? "\x1b[32m" : "",
	yellow: useColor ? "\x1b[33m" : "",
	red: useColor ? "\x1b[31m" : "",
	magenta: useColor ? "\x1b[35m" : "",
};

export type LogContext = {
	tick: number;
	instanceId: string;
	username?: string | null;
	verbose: boolean;
};

type LogDirection = "in" | "out";
type LogLevel = "info" | "warn" | "error";

function getColor(direction: LogDirection, level: LogLevel): string {
	if (level === "error") return ANSI.red;
	if (level === "warn") return ANSI.yellow;
	return direction === "in" ? ANSI.cyan : ANSI.green;
}

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

export function logClientEvent(context: LogContext, message: string, details?: unknown): void {
	log(context, "out", message, details);
}

export function logClientWarning(context: LogContext, message: string, details?: unknown): void {
	log(context, "out", message, details, "warn");
}

export function logClientError(context: LogContext, message: string, details?: unknown): void {
	const normalized = normalizeErrorDetails(details);
	log(context, "out", message, normalized, "error");
}

export function logThinking(context: LogContext, thinking: string): void {
	const formatted = formatThinking(thinking, context.verbose);
	log(context, "out", "thinking", formatted);
}

export function logToolCall(
	context: LogContext,
	toolName: string,
	args: Record<string, unknown>,
): void {
	const maskedArgs = maskSensitiveData(args);
	log(context, "out", `tool call: ${toolName}`, maskedArgs);
}

export function logToolResult(
	context: LogContext,
	toolName: string,
	result: { success: boolean; content: unknown; error?: string },
): void {
	const level = result.success ? "info" : "warn";
	const summary = result.success ? `tool result: ${toolName}` : `tool error: ${toolName}`;
	const details = result.success
		? result.content
		: { error: result.error, content: result.content };
	log(context, "in", summary, maskSensitiveData(details), level);
}

function formatThinking(thinking: string, verbose: boolean): string {
	if (verbose) {
		return thinking;
	}

	const sentences = splitSentences(thinking);
	if (sentences.length <= 3) {
		return sentences.join(" ").trim();
	}
	const first = sentences[0];
	const lastTwo = sentences.slice(-2);
	const omittedCount = sentences.length - 3;
	return `${first} [... ${omittedCount} sentences omitted ...] ${lastTwo.join(" ")}`.trim();
}

function splitSentences(text: string): string[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) {
		return [];
	}
	const matches = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
	if (!matches) {
		return [normalized];
	}
	return matches.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

function normalizeErrorDetails(details: unknown): unknown {
	if (details instanceof Error) {
		return {
			message: details.message,
			stack: details.stack,
		};
	}
	return details;
}

function formatDetailLines(details: unknown, verbose: boolean): string[] {
	if (details === undefined || details === null) {
		return [];
	}
	if (typeof details === "string") {
		return formatMultiline(details, verbose);
	}
	return formatPayloadLines(details, "", verbose, { current: 0 });
}

function formatMultiline(text: string, verbose: boolean): string[] {
	const lines = text.split("\n");
	const truncated =
		verbose || lines.length <= 5
			? lines
			: [lines[0], `[... ${lines.length - 4} more lines ...]`, ...lines.slice(-3)];
	return truncated.map((line) => truncateLine(line));
}

function truncateLine(line: string): string {
	if (line.length <= DETAIL_LINE_MAX_LENGTH) {
		return line;
	}
	return `${line.substring(0, DETAIL_LINE_MAX_LENGTH)}...`;
}

function formatPayloadLines(
	payload: unknown,
	indent: string,
	verbose: boolean,
	lineCount: { current: number },
): string[] {
	if (!payload || typeof payload !== "object") {
		lineCount.current++;
		return [`${indent}${String(payload)}`];
	}

	const lines: string[] = [];
	for (const [key, value] of Object.entries(payload)) {
		if (!verbose && lineCount.current >= 4) {
			lines.push(`${indent}...`);
			return lines;
		}
		if (value === null || value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			if (value.length === 0) {
				lines.push(`${indent}${key}: []`);
				lineCount.current++;
			} else if (typeof value[0] === "object") {
				lines.push(`${indent}${key}: [${value.length} items]`);
				lineCount.current++;
				if (verbose) {
					value.forEach((item, idx) => {
						lines.push(`${indent}  [${idx}]:`);
						lineCount.current++;
						lines.push(...formatPayloadLines(item, `${indent}    `, verbose, lineCount));
					});
				}
			} else {
				lines.push(`${indent}${key}: [${value.join(", ")}]`);
				lineCount.current++;
			}
		} else if (typeof value === "object") {
			lines.push(`${indent}${key}:`);
			lineCount.current++;
			if (verbose || lineCount.current < 4) {
				lines.push(...formatPayloadLines(value, `${indent}  `, verbose, lineCount));
			}
		} else if (typeof value === "string") {
			const truncated = value.length > 100 ? `${value.substring(0, 100)}...` : value;
			lines.push(`${indent}${key}: ${truncated}`);
			lineCount.current++;
		} else {
			lines.push(`${indent}${key}: ${String(value)}`);
			lineCount.current++;
		}
	}

	return lines.map((line) => truncateLine(line));
}

function maskSensitiveData(payload: unknown): unknown {
	if (payload === null || payload === undefined) {
		return payload;
	}
	if (typeof payload !== "object") {
		return payload;
	}
	if (Array.isArray(payload)) {
		return payload.map((item) => maskSensitiveData(item));
	}
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		if (typeof key === "string" && key.toLowerCase().includes("token")) {
			if (typeof value === "string") {
				result[key] = value.length > 8 ? `${value.substring(0, 8)}...` : value;
			} else {
				result[key] = value;
			}
		} else {
			result[key] = maskSensitiveData(value);
		}
	}
	return result;
}
