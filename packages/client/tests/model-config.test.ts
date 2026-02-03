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

	test("should load lfm-thinking config by name", () => {
		const config = loadModelConfig("lfm-thinking");

		expect(config.displayName).toBe("LFM 2.5 Thinking (731MB)");
		expect(config.ollama.model).toBe("lfm2.5-thinking");
		expect(config.ollama.options).toEqual({ temperature: 1.2 });
		expect(config.contextWindow).toBe(4096);
		expect(config.recommended).toBe(true);
	});

	test("should load qwen3 config with thinking option", () => {
		const config = loadModelConfig("qwen3");

		expect(config.displayName).toBe("Qwen3 8B (5.2GB)");
		expect(config.ollama.model).toBe("qwen3:8b");
		expect(config.ollama.options).toEqual({ temperature: 1.2, thinking: true });
		expect(config.contextWindow).toBe(32768);
		expect(config.recommended).toBe(false);
	});

	test("should load qwen2.5 config", () => {
		const config = loadModelConfig("qwen2.5");

		expect(config.displayName).toBe("Qwen2.5 7B (4.7GB)");
		expect(config.ollama.model).toBe("qwen2.5:7b");
		expect(config.ollama.options).toEqual({ temperature: 1.2 });
		expect(config.contextWindow).toBe(32768);
	});

	test("should load deepseek-r1 config", () => {
		const config = loadModelConfig("deepseek-r1");

		expect(config.displayName).toBe("DeepSeek R1 7B (~5GB)");
		expect(config.ollama.model).toBe("deepseek-r1:7b");
		expect(config.ollama.options).toEqual({ temperature: 1.2 });
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
				expect(error.message).toContain("lfm-thinking");
				expect(error.message).toContain("qwen3");
				expect(error.message).toContain("qwen2.5");
				expect(error.message).toContain("deepseek-r1");
			}
		}
	});

	test("should list available models", () => {
		const models = listAvailableModels();

		expect(models).toContain("lfm-thinking");
		expect(models).toContain("qwen3");
		expect(models).toContain("qwen2.5");
		expect(models).toContain("deepseek-r1");
	});

	test("should generate model list text", () => {
		const text = getModelListText();

		expect(text).toContain("lfm-thinking");
		expect(text).toContain("LFM 2.5 Thinking");
		expect(text).toContain("(Recommended)");
	});
});
