const DETAIL_LINE_MAX_LENGTH = 300;
const VALUE_MAX_LENGTH = 100;
const MAX_LINES_NORMAL = 4;
const MAX_MULTILINE_NORMAL = 5;

export function formatDetailLines(details: unknown, verbose: boolean): string[] {
	if (details === undefined || details === null) {
		return [];
	}
	if (typeof details === "string") {
		return formatMultiline(details, verbose);
	}
	return formatPayloadLines(details, "", verbose, { current: 0 });
}

export function formatMultiline(text: string, verbose: boolean): string[] {
	const lines = text.split("\n");
	const truncated =
		verbose || lines.length <= MAX_MULTILINE_NORMAL
			? lines
			: [lines[0], `[... ${lines.length - 4} more lines ...]`, ...lines.slice(-3)];
	return truncated.map((line) => truncateLine(line));
}

export function truncateLine(line: string): string {
	if (line.length <= DETAIL_LINE_MAX_LENGTH) {
		return line;
	}
	return `${line.substring(0, DETAIL_LINE_MAX_LENGTH)}...`;
}

export function formatPayloadLines(
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
		if (!verbose && lineCount.current >= MAX_LINES_NORMAL) {
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
			if (verbose || lineCount.current < MAX_LINES_NORMAL) {
				lines.push(...formatPayloadLines(value, `${indent}  `, verbose, lineCount));
			}
		} else if (typeof value === "string") {
			const truncated =
				value.length > VALUE_MAX_LENGTH ? `${value.substring(0, VALUE_MAX_LENGTH)}...` : value;
			lines.push(`${indent}${key}: ${truncated}`);
			lineCount.current++;
		} else {
			lines.push(`${indent}${key}: ${String(value)}`);
			lineCount.current++;
		}
	}

	return lines.map((line) => truncateLine(line));
}

export function maskSensitiveData(payload: unknown): unknown {
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
	const sensitiveKeys = ["token", "password"];
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		const keyLower = key.toLowerCase();
		if (sensitiveKeys.some((sensitive) => keyLower.includes(sensitive))) {
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

export function formatThinking(thinking: string, verbose: boolean): string {
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

export function splitSentences(text: string): string[] {
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

export function normalizeErrorDetails(details: unknown): unknown {
	if (details instanceof Error) {
		return {
			message: details.message,
			stack: details.stack,
		};
	}
	return details;
}
