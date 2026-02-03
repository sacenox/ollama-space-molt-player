import { describe, expect, test } from "bun:test";
import {
	formatDetailLines,
	formatMultiline,
	formatPayloadLines,
	formatThinking,
	maskSensitiveData,
	normalizeErrorDetails,
	splitSentences,
	truncateLine,
} from "../src/formatter.ts";

describe("truncateLine", () => {
	test("returns short lines unchanged", () => {
		const line = "short line";
		expect(truncateLine(line)).toBe(line);
	});

	test("truncates long lines with ellipsis", () => {
		const longLine = "x".repeat(400);
		const result = truncateLine(longLine);
		expect(result.length).toBe(303);
		expect(result.endsWith("...")).toBe(true);
	});
});

describe("formatMultiline", () => {
	test("returns all lines in verbose mode", () => {
		const text = Array(10).fill("line").join("\n");
		const result = formatMultiline(text, true);
		expect(result.length).toBe(10);
	});

	test("truncates to 5 lines in normal mode", () => {
		const text = Array(10).fill("line").join("\n");
		const result = formatMultiline(text, false);

		expect(result.length).toBe(5);
		expect(result[1]).toContain("more lines");
	});

	test("preserves short text", () => {
		const text = "line1\nline2\nline3";
		const result = formatMultiline(text, false);
		expect(result.length).toBe(3);
	});
});

describe("splitSentences", () => {
	test("splits on periods", () => {
		const result = splitSentences("First. Second. Third.");
		expect(result).toEqual(["First.", "Second.", "Third."]);
	});

	test("handles empty string", () => {
		expect(splitSentences("")).toEqual([]);
	});

	test("handles text without periods", () => {
		expect(splitSentences("no periods here")).toEqual(["no periods here"]);
	});
});

describe("formatThinking", () => {
	test("returns full text in verbose mode", () => {
		const thinking = "First. Second. Third. Fourth. Fifth.";
		expect(formatThinking(thinking, true)).toBe(thinking);
	});

	test("truncates long thinking in normal mode", () => {
		const thinking = "First. Second. Third. Fourth. Fifth.";
		const result = formatThinking(thinking, false);
		expect(result).toContain("omitted");
		expect(result).toContain("First.");
		expect(result).toContain("Fifth.");
	});

	test("preserves short thinking", () => {
		const thinking = "First. Second.";
		const result = formatThinking(thinking, false);
		expect(result).toBe("First. Second.");
	});
});

describe("maskSensitiveData", () => {
	test("masks token fields", () => {
		const data = { token: "secret12345678" };
		const result = maskSensitiveData(data) as Record<string, unknown>;
		expect(result.token).toBe("secret12...");
	});

	test("masks password fields", () => {
		const data = { password: "secret12345678" };
		const result = maskSensitiveData(data) as Record<string, unknown>;
		expect(result.password).toBe("secret12...");
	});

	test("preserves non-sensitive fields", () => {
		const data = { username: "player1", credits: 100 };
		expect(maskSensitiveData(data)).toEqual(data);
	});

	test("handles nested objects", () => {
		const data = { user: { password: "secret12345678", name: "test" } };
		const result = maskSensitiveData(data) as Record<string, Record<string, unknown>>;
		expect(result.user.password).toBe("secret12...");
		expect(result.user.name).toBe("test");
	});

	test("handles arrays", () => {
		const data = [{ token: "secret12345678" }, { token: "another12345678" }];
		const result = maskSensitiveData(data) as Array<Record<string, unknown>>;
		expect(result[0].token).toBe("secret12...");
		expect(result[1].token).toBe("another1...");
	});
});

describe("normalizeErrorDetails", () => {
	test("extracts message and stack from Error", () => {
		const error = new Error("test error");
		const result = normalizeErrorDetails(error) as Record<string, unknown>;
		expect(result.message).toBe("test error");
		expect(result.stack).toBeDefined();
	});

	test("returns non-Error values unchanged", () => {
		const data = { error: "some error" };
		expect(normalizeErrorDetails(data)).toBe(data);
	});
});

describe("formatPayloadLines", () => {
	test("formats simple object", () => {
		const data = { name: "test", value: 42 };
		const result = formatPayloadLines(data, "", true, { current: 0 });
		expect(result).toContain("name: test");
		expect(result).toContain("value: 42");
	});

	test("truncates in normal mode", () => {
		const data = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
		const result = formatPayloadLines(data, "", false, { current: 0 });
		expect(result[result.length - 1]).toBe("...");
	});

	test("formats nested objects", () => {
		const data = { outer: { inner: "value" } };
		const result = formatPayloadLines(data, "", true, { current: 0 });
		expect(result.some((line) => line.includes("outer:"))).toBe(true);
		expect(result.some((line) => line.includes("inner: value"))).toBe(true);
	});

	test("formats arrays", () => {
		const data = { items: [1, 2, 3] };
		const result = formatPayloadLines(data, "", true, { current: 0 });
		expect(result.some((line) => line.includes("[1, 2, 3]"))).toBe(true);
	});

	test("summarizes object arrays", () => {
		const data = { items: [{ id: 1 }, { id: 2 }] };
		const result = formatPayloadLines(data, "", false, { current: 0 });
		expect(result.some((line) => line.includes("[2 items]"))).toBe(true);
	});
});

describe("formatDetailLines", () => {
	test("returns empty array for null/undefined", () => {
		expect(formatDetailLines(null, false)).toEqual([]);
		expect(formatDetailLines(undefined, false)).toEqual([]);
	});

	test("handles string input", () => {
		const result = formatDetailLines("test string", false);
		expect(result).toEqual(["test string"]);
	});

	test("handles object input", () => {
		const result = formatDetailLines({ key: "value" }, false);
		expect(result.some((line) => line.includes("key: value"))).toBe(true);
	});
});
