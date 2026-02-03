import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Server } from "bun";
import { GameClient } from "../src/game-client.ts";
import { GameDatabase } from "../src/db.ts";
import { unlink, exists } from "node:fs/promises";

describe("GameClient agent loop", () => {
	let ollamaServer: Server<unknown> | null = null;
	let mcpServer: Server<unknown> | null = null;
	let db: GameDatabase | null = null;
	const testInstanceId = "test-agent-loop";
	const dbPath = `data/${testInstanceId}.db`;

	beforeEach(async () => {
		if (await exists(dbPath)) {
			await unlink(dbPath);
		}
	});

	afterEach(async () => {
		ollamaServer?.stop();
		ollamaServer = null;
		mcpServer?.stop();
		mcpServer = null;
		db?.close();
		db = null;

		if (await exists(dbPath)) {
			await unlink(dbPath);
		}
	});

	test("agent loop should continue after text-only LLM response", async () => {
		const llmResponses: Array<{ content: string; tool_calls?: unknown[] }> = [];
		let llmCallCount = 0;
		const maxRounds = 3;

		ollamaServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				llmCallCount++;

				if (llmCallCount === 1) {
					const response = {
						model: "test",
						created_at: new Date().toISOString(),
						message: {
							role: "assistant",
							content: "",
							tool_calls: [
								{
									function: {
										name: "register",
										arguments: { username: "TestBot", empire: "solarian" },
									},
								},
							],
						},
						done: true,
					};
					llmResponses.push(response.message);
					return Response.json(response);
				}

				const response = {
					model: "test",
					created_at: new Date().toISOString(),
					message: {
						role: "assistant",
						content: `Round ${llmCallCount} response - continuing play`,
					},
					done: true,
				};
				llmResponses.push(response.message);
				return Response.json(response);
			},
		});

		mcpServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				const body = await req.json();

				if (body.method === "initialize") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							protocolVersion: "2024-11-05",
							capabilities: { tools: {} },
							serverInfo: { name: "test-mcp", version: "1.0.0" },
						},
					});
				}

				if (body.method === "tools/list") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							tools: [
								{
									name: "register",
									description: "Register a new player",
									inputSchema: {
										type: "object",
										properties: {
											username: { type: "string" },
											empire: { type: "string" },
										},
										required: ["username", "empire"],
									},
								},
							],
						},
					});
				}

				if (body.method === "tools/call") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							content: [{ type: "text", text: JSON.stringify({ error: "username_taken" }) }],
							isError: true,
						},
					});
				}

				return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
			},
		});

		db = new GameDatabase(testInstanceId);
		const client = new GameClient(db, {
			instanceId: testInstanceId,
			model: "qwen3-8b",
			verbose: false,
			tickRate: 20000,
			ollamaTimeout: 5000,
			serverUrl: `http://localhost:${mcpServer.port}`,
		});

		client.ollama.updateConfig({ baseUrl: `http://localhost:${ollamaServer.port}` });

		const startPromise = client.start();

		await new Promise((resolve) => setTimeout(resolve, 3500));

		await client.stop();

		expect(llmCallCount).toBeGreaterThanOrEqual(maxRounds);

		const textOnlyResponses = llmResponses.filter(
			(r) => !r.tool_calls || r.tool_calls.length === 0,
		);
		expect(textOnlyResponses.length).toBeGreaterThanOrEqual(2);
	});

	test("agent loop should log round start for visibility", async () => {
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			logs.push(args.join(" "));
			originalLog(...args);
		};

		let llmCallCount = 0;

		ollamaServer = Bun.serve({
			port: 0,
			fetch: async () => {
				llmCallCount++;
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					message: {
						role: "assistant",
						content: `Response ${llmCallCount}`,
					},
					done: true,
				});
			},
		});

		mcpServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				const body = await req.json();
				if (body.method === "initialize") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							protocolVersion: "2024-11-05",
							capabilities: { tools: {} },
							serverInfo: { name: "test-mcp", version: "1.0.0" },
						},
					});
				}
				if (body.method === "tools/list") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: { tools: [] },
					});
				}
				return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
			},
		});

		db = new GameDatabase(testInstanceId);
		const client = new GameClient(db, {
			instanceId: testInstanceId,
			model: "qwen3-8b",
			verbose: false,
			tickRate: 20000,
			ollamaTimeout: 5000,
			serverUrl: `http://localhost:${mcpServer.port}`,
		});

		client.ollama.updateConfig({ baseUrl: `http://localhost:${ollamaServer.port}` });

		const startPromise = client.start();
		await new Promise((resolve) => setTimeout(resolve, 2500));
		await client.stop();

		console.log = originalLog;

		expect(llmCallCount).toBeGreaterThanOrEqual(2);

		expect(logs.some((l) => l.includes("Starting agent loop"))).toBe(true);
	});

	test("agent loop should handle LLM timeout gracefully", { timeout: 15000 }, async () => {
		const errors: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) => {
			errors.push(args.join(" "));
			originalError(...args);
		};

		let requestCount = 0;

		ollamaServer = Bun.serve({
			port: 0,
			fetch: async () => {
				requestCount++;

				if (requestCount === 1) {
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}
				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					message: { role: "assistant", content: "response" },
					done: true,
				});
			},
		});

		mcpServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				const body = await req.json();
				if (body.method === "initialize") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							protocolVersion: "2024-11-05",
							capabilities: { tools: {} },
							serverInfo: { name: "test-mcp", version: "1.0.0" },
						},
					});
				}
				if (body.method === "tools/list") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: { tools: [] },
					});
				}
				return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
			},
		});

		db = new GameDatabase(testInstanceId);
		const client = new GameClient(db, {
			instanceId: testInstanceId,
			model: "qwen3-8b",
			verbose: false,
			tickRate: 20000,
			ollamaTimeout: 500,
			serverUrl: `http://localhost:${mcpServer.port}`,
		});

		client.ollama.updateConfig({ baseUrl: `http://localhost:${ollamaServer.port}` });

		const startPromise = client.start();

		await new Promise((resolve) => setTimeout(resolve, 7000));
		await client.stop();

		console.error = originalError;

		expect(errors.some((e) => e.includes("Agent loop error") || e.includes("timed out"))).toBe(
			true,
		);

		expect(requestCount).toBeGreaterThan(1);
	});

	test("agent loop should nudge LLM when it returns empty response", async () => {
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			logs.push(args.join(" "));
			originalLog(...args);
		};

		let llmCallCount = 0;
		let lastRequestMessages: unknown[] = [];

		ollamaServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				llmCallCount++;
				const body = await req.json();
				lastRequestMessages = body.messages || [];

				if (llmCallCount <= 2) {
					return Response.json({
						model: "test",
						created_at: new Date().toISOString(),
						message: {
							role: "assistant",
							content: "",
						},
						done: true,
					});
				}

				return Response.json({
					model: "test",
					created_at: new Date().toISOString(),
					message: {
						role: "assistant",
						content: "Now taking action!",
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

		mcpServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				const body = await req.json();
				if (body.method === "initialize") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							protocolVersion: "2024-11-05",
							capabilities: { tools: {} },
							serverInfo: { name: "test-mcp", version: "1.0.0" },
						},
					});
				}
				if (body.method === "tools/list") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							tools: [
								{
									name: "get_status",
									description: "Get player status",
									inputSchema: { type: "object", properties: {}, required: [] },
								},
							],
						},
					});
				}
				if (body.method === "tools/call") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }],
						},
					});
				}
				return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
			},
		});

		db = new GameDatabase(testInstanceId);
		const client = new GameClient(db, {
			instanceId: testInstanceId,
			model: "qwen3-8b",
			verbose: false,
			tickRate: 20000,
			ollamaTimeout: 5000,
			serverUrl: `http://localhost:${mcpServer.port}`,
		});

		client.ollama.updateConfig({ baseUrl: `http://localhost:${ollamaServer.port}` });

		const startPromise = client.start();
		await new Promise((resolve) => setTimeout(resolve, 2500));
		await client.stop();

		console.log = originalLog;

		expect(llmCallCount).toBeGreaterThanOrEqual(3);

		expect(logs.some((l) => l.includes("empty response") || l.includes("nudging"))).toBe(true);

		const hasNudgeMessage = lastRequestMessages.some(
			(msg: any) =>
				msg.role === "user" &&
				typeof msg.content === "string" &&
				msg.content.includes("didn't take any action"),
		);
		expect(hasNudgeMessage).toBe(true);
	});
});
