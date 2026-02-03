import { describe, expect, test } from "bun:test";
import { stripComments } from "./strip-comments.ts";

describe("stripComments", () => {
	test("preserves regex with //", () => {
		const input = `const urlPattern = /https:\\/\\/example\\.com/;`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("preserves regex with /*", () => {
		const input = `const commentPattern = /\\/\\*.*?\\*\\//;`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("preserves regex with flags", () => {
		const input = `const pattern = /test\\/\\//gi;`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("removes single-line comments", () => {
		const input = `const x = 1; // this is a comment\nconst y = 2;`;
		const expected = `const x = 1; \nconst y = 2;`;
		const output = stripComments(input);
		expect(output).toBe(expected);
	});

	test("removes multi-line comments", () => {
		const input = `const x = 1; /* this is a\nmulti-line comment */\nconst y = 2;`;
		const expected = `const x = 1; \nconst y = 2;`;
		const output = stripComments(input);
		expect(output).toBe(expected);
	});

	test("preserves strings with comment-like content", () => {
		const input = `const str = "this has // in it";`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("preserves template literals with comment-like content", () => {
		const input = "const str = `this has // and /* */ in it`;";
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("handles regex after return", () => {
		const input = `return /test\\/\\//;`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("handles regex after assignment", () => {
		const input = `const re = /pattern\\/\\//;`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("handles regex in array", () => {
		const input = `const patterns = [/test\\/\\//];`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("handles regex as function argument", () => {
		const input = `someFunc(/test\\/\\//);`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("handles complex mixed scenario", () => {
		const input = `const url = /https:\\/\\//; // URL pattern\nconst str = "not a // comment";\n/* block comment */\nconst tmpl = \`also not /* a comment */\`;`;
		const expected = `const url = /https:\\/\\//; \nconst str = "not a // comment";\n\nconst tmpl = \`also not /* a comment */\`;`;
		const output = stripComments(input);
		expect(output).toBe(expected);
	});

	test("handles division operator vs regex", () => {
		const input = `const x = 10 / 2;\nconst re = /pattern/;`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("preserves code without comments unchanged", () => {
		const input = `function test() {\n\treturn 42;\n}`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("removes JSDoc comments", () => {
		const input = `/**\n * JSDoc comment\n */\nfunction test() {}`;
		const expected = `\nfunction test() {}`;
		const output = stripComments(input);
		expect(output).toBe(expected);
	});

	test("handles escaped quotes in strings", () => {
		const input = `const str = "she said \\"hello // world\\"";`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("handles escaped backslashes in regex", () => {
		const input = `const re = /\\\\/;`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("cleans up multiple blank lines", () => {
		const input = `const x = 1;\n\n\n\nconst y = 2;`;
		const expected = `const x = 1;\n\nconst y = 2;`;
		const output = stripComments(input);
		expect(output).toBe(expected);
	});

	test("handles regex after various operators", () => {
		const input = `x = /a/;\ny ? /b/ : /c/;\nif (/d/.test(s)) {}\n!!/e/.test(s);`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});

	test("handles regex with all flags", () => {
		const input = `const re = /pattern/gimsuy;`;
		const output = stripComments(input);
		expect(output).toBe(input);
	});
});
