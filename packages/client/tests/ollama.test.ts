import { afterEach, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { OllamaClient } from "../src/ollama.ts";

describe("OllamaClient", () => {
	let client: OllamaClient;
	let mockServer: Server<unknown> | null = null;

	afterEach(() => {
		mockServer?.stop();
		mockServer = null;
	});

	test("should create client with config", () => {
		client = new OllamaClient({
			baseUrl: "http://localhost:11434",
			model: "qwen3:8b",
			options: { temperature: 1.2 },
			timeout: 8000,
		});
		const config = client.getConfig();

		expect(config.baseUrl).toBe("http://localhost:11434");
		expect(config.model).toBe("qwen3:8b");
		expect(config.options).toEqual({ temperature: 1.2 });
		expect(config.timeout).toBe(8000);
	});

	test("should create client with custom options", () => {
		client = new OllamaClient({
			baseUrl: "http://custom:9999",
			model: "custom-model",
			options: { temperature: 0.5, thinking: true },
			timeout: 5000,
		});

		const config = client.getConfig();

		expect(config.baseUrl).toBe("http://custom:9999");
		expect(config.model).toBe("custom-model");
		expect(config.options).toEqual({ temperature: 0.5, thinking: true });
		expect(config.timeout).toBe(5000);
	});

	test("should update config", () => {
		client = new OllamaClient({
			baseUrl: "http://localhost:11434",
			model: "old-model",
			options: { temperature: 1.2 },
			timeout: 8000,
		});
		client.updateConfig({ model: "new-model", options: { temperature: 0.8 } });

		const config = client.getConfig();
		expect(config.model).toBe("new-model");
		expect(config.options).toEqual({ temperature: 0.8 });
	});

	test("should make successful generation request", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				const body = await req.json();
				return Response.json({
					model: body.model,
					created_at: new Date().toISOString(),
					response: "test response",
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: {},
			timeout: 8000,
		});

		const result = await client.generate("test prompt");
		expect(result.response).toBe("test response");
		expect(result.thinking).toBeUndefined();
	});

	test("should trim response", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					response: "  trimmed  \n",
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: {},
			timeout: 8000,
		});

		const result = await client.generate("test");
		expect(result.response).toBe("trimmed");
	});

	test("should handle timeout", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				await new Promise((resolve) => setTimeout(resolve, 200));
				return Response.json({ response: "late" });
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: {},
			timeout: 100,
		});

		await expect(client.generate("test")).rejects.toThrow(/timed out/);
	});

	test("should handle HTTP errors", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: () => {
				return new Response("Server error", { status: 500 });
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: {},
			timeout: 8000,
		});

		await expect(client.generate("test")).rejects.toThrow(/status 500/);
	});

	test("should handle missing response field", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: () => {
				return Response.json({
					model: "test",
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: {},
			timeout: 8000,
		});

		await expect(client.generate("test")).rejects.toThrow(/missing 'response' field/);
	});

	test("should pass options with thinking enabled", async () => {
		let capturedRequest: { options: Record<string, unknown> } | null = null;

		mockServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				capturedRequest = await req.json();
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					response: "response",
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: { thinking: true, temperature: 1.2 },
			timeout: 8000,
		});

		await client.generate("test");

		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest!.options.thinking).toBe(true);
		expect(capturedRequest!.options.temperature).toBe(1.2);
	});

	test("should pass options without thinking", async () => {
		let capturedRequest: { options: Record<string, unknown> } | null = null;

		mockServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				capturedRequest = await req.json();
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					response: "response",
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: { temperature: 0.8 },
			timeout: 8000,
		});

		await client.generate("test");

		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest!.options.thinking).toBeUndefined();
		expect(capturedRequest!.options.temperature).toBe(0.8);
	});

	test("should return thinking content when provided", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					response: "final answer",
					thinking: "reasoning process here",
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: { thinking: true },
			timeout: 8000,
		});

		const result = await client.generate("test");
		expect(result.response).toBe("final answer");
		expect(result.thinking).toBe("reasoning process here");
	});

	test("should extract thinking from response tags", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					response:
						'<think>First sentence. Second sentence. Third sentence.</think>\n{"type":"mine"}',
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: { thinking: true },
			timeout: 8000,
		});

		const result = await client.generate("test");
		expect(result.response).toBe('{"type":"mine"}');
		expect(result.thinking).toBe("First sentence. Second sentence. Third sentence.");
	});

	test("should prefer Ollama thinking over response tags", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					response: '<think>Tagged thinking</think>\n{"type":"scan"}',
					thinking: "Ollama thinking",
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: { thinking: true },
			timeout: 8000,
		});

		const result = await client.generate("test");
		expect(result.response).toBe('{"type":"scan"}');
		expect(result.thinking).toBe("Ollama thinking");
	});

	test("should ignore empty thinking tags", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					response: '<think>\n\t\n</think>\n{"type":"dock"}',
					done: true,
				});
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: { thinking: true },
			timeout: 8000,
		});

		const result = await client.generate("test");
		expect(result.response).toBe('{"type":"dock"}');
		expect(result.thinking).toBeUndefined();
	});
});
