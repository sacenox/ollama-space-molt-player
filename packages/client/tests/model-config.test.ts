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

	test("should load qwen3-8b config", () => {
		const config = loadModelConfig("qwen3-8b");

		expect(config.displayName).toBe("Qwen3 8B (Tool Calling)");
		expect(config.ollama.model).toBe("qwen3:8b");
		expect(config.ollama.options).toEqual({ temperature: 0.7 });
		expect(config.contextWindow).toBe(32768);
		expect(config.recommendedMessages).toBe(50);
		expect(config.recommended).toBe(true);
	});

	test("should load qwen3-4b config", () => {
		const config = loadModelConfig("qwen3-4b");

		expect(config.displayName).toBe("Qwen3 4B (2.5GB)");
		expect(config.ollama.model).toBe("qwen3:4b");
		expect(config.ollama.options).toEqual({ temperature: 0.7 });
		expect(config.contextWindow).toBe(32768);
		expect(config.recommendedMessages).toBe(50);
	});

	test("should load llama3.1-8b config", () => {
		const config = loadModelConfig("llama3.1-8b");

		expect(config.displayName).toBe("Llama 3.1 8B (Tool Calling)");
		expect(config.ollama.model).toBe("llama3.1:8b");
		expect(config.contextWindow).toBe(131072);
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
				expect(error.message).toContain("qwen3-8b");
				expect(error.message).toContain("qwen3-4b");
				expect(error.message).toContain("llama3.1-8b");
			}
		}
	});

	test("should list available models", () => {
		const models = listAvailableModels();

		expect(models).toContain("qwen3-8b");
		expect(models).toContain("qwen3-4b");
		expect(models).toContain("llama3.1-8b");
		expect(models).toContain("mistral-nemo");
		expect(models).toHaveLength(4);
	});

	test("should generate model list text", () => {
		const text = getModelListText();

		expect(text).toContain("qwen3-8b");
		expect(text).toContain("Qwen3 8B");
		expect(text).toContain("(Recommended)");
	});
});
