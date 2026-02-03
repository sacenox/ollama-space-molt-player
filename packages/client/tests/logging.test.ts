import { describe, expect, test } from "bun:test";
import { formatThinking } from "../src/logging.ts";

describe("formatThinking", () => {
	test("should return full thinking when verbose", () => {
		const text = "First sentence. Second sentence. Third sentence.";
		const result = formatThinking(text, true);
		expect(result).toBe(text);
	});

	test("should summarize thinking when not verbose", () => {
		const text =
			"First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. Sixth sentence.";
		const result = formatThinking(text, false);
		expect(result).toBe(
			"First sentence. [... 3 sentences omitted ...] Fifth sentence. Sixth sentence.",
		);
	});

	test("should keep short thinking intact", () => {
		const text = "Only sentence one. Sentence two. Sentence three.";
		const result = formatThinking(text, false);
		expect(result).toBe("Only sentence one. Sentence two. Sentence three.");
	});
});
