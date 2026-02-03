#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "glob";

export function stripComments(content: string): string {
	let result = "";
	let i = 0;
	let inString = false;
	let stringChar = "";
	let inTemplate = false;
	let inRegex = false;
	let lastChar = "";

	const regexStartContext = new Set([
		"=",
		"(",
		"[",
		"{",
		",",
		";",
		"!",
		"&",
		"|",
		"?",
		":",
		"~",
		"+",
		"-",
		"*",
		"%",
		"<",
		">",
		"^",
		"\n",
		"",
	]);

	function isRegexContext(text: string, pos: number): boolean {
		let j = pos - 1;
		while (j >= 0 && /\s/.test(text[j])) {
			j--;
		}
		if (j < 0) return true;

		const prevChar = text[j];
		if (regexStartContext.has(prevChar)) return true;

		const keywords = ["return", "throw", "typeof", "void", "delete", "new", "case"];
		for (const keyword of keywords) {
			const start = j - keyword.length + 1;
			if (start >= 0) {
				const word = text.substring(start, j + 1);
				if (word === keyword) {
					const beforeWord = start > 0 ? text[start - 1] : "";
					if (!beforeWord || /\s/.test(beforeWord) || regexStartContext.has(beforeWord)) {
						return true;
					}
				}
			}
		}

		return false;
	}

	while (i < content.length) {
		const char = content[i];
		const next = content[i + 1];

		if (!inString && !inTemplate && !inRegex && (char === '"' || char === "'")) {
			inString = true;
			stringChar = char;
			result += char;
			i++;
			continue;
		}

		if (inString && char === stringChar) {
			let escapeCount = 0;
			let pos = i - 1;
			while (pos >= 0 && content[pos] === "\\") {
				escapeCount++;
				pos--;
			}
			if (escapeCount % 2 === 0) {
				inString = false;
			}
			result += char;
			i++;
			continue;
		}

		if (!inString && !inTemplate && !inRegex && char === "`") {
			inTemplate = true;
			result += char;
			i++;
			continue;
		}

		if (inTemplate && char === "`") {
			let escapeCount = 0;
			let pos = i - 1;
			while (pos >= 0 && content[pos] === "\\") {
				escapeCount++;
				pos--;
			}
			if (escapeCount % 2 === 0) {
				inTemplate = false;
			}
			result += char;
			i++;
			continue;
		}

		if (!inString && !inTemplate && !inRegex && char === "/" && next !== "/" && next !== "*") {
			if (isRegexContext(content, i)) {
				inRegex = true;
				result += char;
				i++;
				continue;
			}
		}

		if (inRegex && char === "/") {
			let escapeCount = 0;
			let pos = i - 1;
			while (pos >= 0 && content[pos] === "\\") {
				escapeCount++;
				pos--;
			}
			if (escapeCount % 2 === 0) {
				inRegex = false;
				result += char;
				i++;
				while (i < content.length && /[gimsuyd]/.test(content[i])) {
					result += content[i];
					i++;
				}
				continue;
			}
		}

		if (inString || inTemplate || inRegex) {
			result += char;
			i++;
			continue;
		}

		if (char === "/" && next === "/") {
			i += 2;
			while (i < content.length && content[i] !== "\n") {
				i++;
			}
			if (i < content.length) {
				result += "\n";
				i++;
			}
			continue;
		}

		if (char === "/" && next === "*") {
			i += 2;
			while (i < content.length - 1) {
				if (content[i] === "*" && content[i + 1] === "/") {
					i += 2;
					break;
				}
				i++;
			}
			continue;
		}

		result += char;
		if (!/\s/.test(char)) {
			lastChar = char;
		}
		i++;
	}

	result = result.replace(/\n{3,}/g, "\n\n");

	return result;
}

if (import.meta.main) {
	const files = globSync("packages/*/src/**/*.ts", { cwd: process.cwd() });
	const testFiles = globSync("packages/*/tests/**/*.ts", { cwd: process.cwd() });
	const allFiles = [...files, ...testFiles];

	let strippedCount = 0;

	for (const file of allFiles) {
		const content = readFileSync(file, "utf-8");
		const stripped = stripComments(content);

		if (content !== stripped) {
			writeFileSync(file, stripped, "utf-8");
			strippedCount++;
			console.log(`Stripped comments from: ${file}`);
		}
	}

	console.log(`\nProcessed ${allFiles.length} files, modified ${strippedCount} files`);
}
