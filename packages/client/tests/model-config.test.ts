import { describe, expect, test } from "bun:test";
import { loadModelConfig, listAvailableModels, getModelListText } from "../src/model-config.ts";

describe("Model Configuration", () => {
	test("should load default config when no name provided", () => {
		const config = loadModelConfig();

		expect(config).toBeDefined();
		expect(config.displayName).toBeDefined();
		expect(config.ollama.model).toBeDefined();
		expect(config.ollama.options).toBeDefined();
	});

	test("should load qwen3-4b config", () => {
		const config = loadModelConfig("qwen3-4b");

		expect(config.displayName).toBe("Qwen3 4B (2.5GB)");
		expect(config.ollama.model).toBe("qwen3:4b");
		expect(config.ollama.options).toEqual({ temperature: 1.2 });
		expect(config.contextWindow).toBe(32768);
		expect(config.recommendedMessages).toBe(10);
		expect(config.recommended).toBe(true);
	});

	test("should load deepseek-r1-1.5b config", () => {
		const config = loadModelConfig("deepseek-r1-1.5b");

		expect(config.displayName).toBe("DeepSeek R1 1.5B (1.1GB)");
		expect(config.ollama.model).toBe("deepseek-r1:1.5b");
		expect(config.ollama.options).toEqual({ temperature: 1.2, thinking: true });
		expect(config.contextWindow).toBe(32768);
		expect(config.recommendedMessages).toBe(10);
	});

	test("should load lfm-thinking config", () => {
		const config = loadModelConfig("lfm-thinking");

		expect(config.displayName).toBe("LFM 2.5 Thinking (731MB)");
		expect(config.ollama.model).toBe("lfm2.5-thinking:latest");
		expect(config.ollama.options).toEqual({ temperature: 1.2 });
		expect(config.contextWindow).toBe(32768);
		expect(config.recommendedMessages).toBe(11);
	});

	test("should throw error for non-existent config", () => {
		expect(() => {
			loadModelConfig("non-existent-model");
		}).toThrow(/not found/);
	});

	test("should list available models in error message", () => {
		try {
			loadModelConfig("invalid");
		} catch (error) {
			if (error instanceof Error) {
				expect(error.message).toContain("qwen3-4b");
				expect(error.message).toContain("deepseek-r1-1.5b");
				expect(error.message).toContain("lfm-thinking");
			}
		}
	});

	test("should list available models", () => {
		const models = listAvailableModels();

		expect(models).toContain("qwen3-4b");
		expect(models).toContain("deepseek-r1-1.5b");
		expect(models).toContain("lfm-thinking");
		expect(models).toHaveLength(3);
	});

	test("should generate model list text", () => {
		const text = getModelListText();

		expect(text).toContain("qwen3-4b");
		expect(text).toContain("Qwen3 4B");
		expect(text).toContain("(Recommended)");
	});
});
