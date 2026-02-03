import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/cli.ts";

describe("CLI Argument Parser", () => {
	test("should parse help command", () => {
		const result = parseArgs(["help"]);
		expect(result.command).toBe("help");
	});

	test("should parse --help flag", () => {
		const result = parseArgs(["--help"]);
		expect(result.command).toBe("help");
	});

	test("should parse list-instances command", () => {
		const result = parseArgs(["list-instances"]);
		expect(result.command).toBe("list-instances");
	});

	test("should parse update-hint command", () => {
		const result = parseArgs(["update-hint", "--instance", "abc1", "--hint", "test hint"]);
		expect(result.command).toBe("update-hint");
		expect(result.instanceId).toBe("abc1");
		expect(result.hint).toBe("test hint");
	});

	test("should throw error for update-hint without instance", () => {
		expect(() => {
			parseArgs(["update-hint", "--hint", "test"]);
		}).toThrow(/requires.*instance/);
	});

	test("should throw error for update-hint without hint", () => {
		expect(() => {
			parseArgs(["update-hint", "--instance", "abc1"]);
		}).toThrow(/requires.*hint/);
	});

	test("should parse start command with defaults", () => {
		const result = parseArgs(["start"]);
		expect(result.command).toBe("start");
		expect(result.config?.model).toBe("qwen3:8b");
		expect(result.config?.temperature).toBe(1.2);
	});

	test("should parse start with instance ID", () => {
		const result = parseArgs(["start", "--instance", "test1"]);
		expect(result.command).toBe("start");
		expect(result.config?.instanceId).toBe("test1");
	});

	test("should parse start with short instance flag", () => {
		const result = parseArgs(["start", "-i", "test2"]);
		expect(result.config?.instanceId).toBe("test2");
	});

	test("should parse start with hint", () => {
		const result = parseArgs(["start", "--hint", "focus on trading"]);
		expect(result.config?.hint).toBe("focus on trading");
	});

	test("should parse start with custom model", () => {
		const result = parseArgs(["start", "--model", "llama3:8b"]);
		expect(result.config?.model).toBe("llama3:8b");
	});

	test("should parse start with short model flag", () => {
		const result = parseArgs(["start", "-m", "custom"]);
		expect(result.config?.model).toBe("custom");
	});

	test("should parse start with temperature", () => {
		const result = parseArgs(["start", "--temperature", "0.8"]);
		expect(result.config?.temperature).toBe(0.8);
	});

	test("should parse start with short temperature flag", () => {
		const result = parseArgs(["start", "-t", "1.5"]);
		expect(result.config?.temperature).toBe(1.5);
	});

	test("should parse start with thinking", () => {
		const result = parseArgs(["start", "--thinking"]);
		expect(result.config?.thinking).toBe(true);
	});

	test("should default thinking to false when not specified", () => {
		const result = parseArgs(["start"]);
		expect(result.config?.thinking).toBe(false);
	});

	test("should parse start with archetype", () => {
		const result = parseArgs(["start", "--archetype", "diplomat"]);
		expect(result.config?.archetype).toBe("diplomat");
	});

	test("should parse start with short archetype flag", () => {
		const result = parseArgs(["start", "-a", "agitator"]);
		expect(result.config?.archetype).toBe("agitator");
	});

	test("should parse start with multiple options", () => {
		const result = parseArgs([
			"start",
			"-i",
			"xyz9",
			"-m",
			"qwen2:7b",
			"-t",
			"0.9",
			"-a",
			"opportunist",
			"--hint",
			"explore",
		]);

		expect(result.config?.instanceId).toBe("xyz9");
		expect(result.config?.model).toBe("qwen2:7b");
		expect(result.config?.temperature).toBe(0.9);
		expect(result.config?.archetype).toBe("opportunist");
		expect(result.config?.hint).toBe("explore");
	});

	test("should throw error for unknown command", () => {
		expect(() => {
			parseArgs(["unknown-command"]);
		}).toThrow(/Unknown command/);
	});

	test("should default to help with no args", () => {
		const result = parseArgs([]);
		expect(result.command).toBe("help");
	});
});
