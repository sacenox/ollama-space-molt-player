import { afterEach, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { OllamaClient, type ChatMessage } from "../src/ollama.ts";

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
			options: { temperature: 0.7 },
			timeout: 8000,
		});
		const config = client.getConfig();

		expect(config.baseUrl).toBe("http://localhost:11434");
		expect(config.model).toBe("qwen3:8b");
		expect(config.options).toEqual({ temperature: 0.7 });
		expect(config.timeout).toBe(8000);
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

	test("should make successful chat request", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				const body = await req.json();
				expect(body.messages).toBeDefined();
				return Response.json({
					model: body.model,
					created_at: new Date().toISOString(),
					message: {
						role: "assistant",
						content: "test response",
					},
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

		const messages: ChatMessage[] = [{ role: "user", content: "test prompt" }];
		const result = await client.chat(messages);
		expect(result.content).toBe("test response");
		expect(result.toolCalls).toEqual([]);
		expect(result.thinking).toBeUndefined();
	});

	test("should handle tool calls in response", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					message: {
						role: "assistant",
						content: "",
						tool_calls: [
							{
								function: {
									name: "get_status",
									arguments: {},
								},
							},
						],
					},
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

		const messages: ChatMessage[] = [{ role: "user", content: "check status" }];
		const result = await client.chat(messages);

		expect(result.toolCalls.length).toBe(1);
		expect(result.toolCalls[0].function.name).toBe("get_status");
	});

	test("should pass tools to request", async () => {
		let capturedRequest: { tools?: unknown[] } | undefined;

		mockServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				capturedRequest = await req.json();
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					message: { role: "assistant", content: "ok" },
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

		const tools = [
			{
				type: "function" as const,
				function: {
					name: "test_tool",
					description: "A test tool",
					parameters: { type: "object", properties: {}, required: [] },
				},
			},
		];

		await client.chat([{ role: "user", content: "test" }], tools);

		expect(capturedRequest?.tools).toBeDefined();
		expect(capturedRequest?.tools?.length).toBe(1);
	});

	test("should handle timeout", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				await new Promise((resolve) => setTimeout(resolve, 200));
				return Response.json({ message: { content: "late" } });
			},
		});

		client = new OllamaClient({
			baseUrl: `http://localhost:${mockServer.port}`,
			model: "test-model",
			options: {},
			timeout: 100,
		});

		await expect(client.chat([{ role: "user", content: "test" }])).rejects.toThrow(/timed out/);
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

		await expect(client.chat([{ role: "user", content: "test" }])).rejects.toThrow(/status 500/);
	});

	test("should extract thinking from response content", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					message: {
						role: "assistant",
						content: "<think>reasoning here</think>\nfinal answer",
					},
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

		const result = await client.chat([{ role: "user", content: "test" }]);
		expect(result.content).toBe("final answer");
		expect(result.thinking).toBe("reasoning here");
	});

	test("should handle empty content", async () => {
		mockServer = Bun.serve({
			port: 0,
			fetch: async () => {
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					message: {
						role: "assistant",
						content: "",
						tool_calls: [{ function: { name: "mine", arguments: {} } }],
					},
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

		const result = await client.chat([{ role: "user", content: "test" }]);
		expect(result.content).toBe("");
		expect(result.toolCalls.length).toBe(1);
	});
});
