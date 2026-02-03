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

	test("should create client with default config", () => {
		client = new OllamaClient();
		const config = client.getConfig();

		expect(config.baseUrl).toBe("http://localhost:11434");
		expect(config.model).toBe("qwen3:8b");
		expect(config.temperature).toBe(1.2);
		expect(config.thinking).toBe(false);
		expect(config.timeout).toBe(8000);
	});

	test("should create client with custom config", () => {
		client = new OllamaClient({
			baseUrl: "http://custom:9999",
			model: "custom-model",
			temperature: 0.5,
			thinking: true,
			timeout: 5000,
		});

		const config = client.getConfig();

		expect(config.baseUrl).toBe("http://custom:9999");
		expect(config.model).toBe("custom-model");
		expect(config.temperature).toBe(0.5);
		expect(config.thinking).toBe(true);
		expect(config.timeout).toBe(5000);
	});

	test("should update config", () => {
		client = new OllamaClient();
		client.updateConfig({ model: "new-model", temperature: 0.8 });

		const config = client.getConfig();
		expect(config.model).toBe("new-model");
		expect(config.temperature).toBe(0.8);
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
		});

		const response = await client.generate("test prompt");
		expect(response).toBe("test response");
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
		});

		const response = await client.generate("test");
		expect(response).toBe("trimmed");
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
		});

		await expect(client.generate("test")).rejects.toThrow(/missing 'response' field/);
	});

	test("should include thinking when enabled", async () => {
		let capturedRequest: { options: { thinking?: boolean } } | null = null;

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
			thinking: true,
		});

		await client.generate("test");

		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest!.options.thinking).toBe(true);
	});

	test("should not include thinking when false", async () => {
		let capturedRequest: { options: { thinking?: boolean } } | null = null;

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
		});

		await client.generate("test");

		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest!.options.thinking).toBeUndefined();
	});
});
