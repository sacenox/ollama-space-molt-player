import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Server } from "bun";
import { GameClient } from "../src/game-client.ts";
import { GameDatabase } from "../src/db.ts";
import { unlink, exists } from "node:fs/promises";

/**
 * Tests for GameClient agent loop behavior.
 * 
 * These tests verify that:
 * 1. The agent loop continues after text-only LLM responses
 * 2. Timeouts are properly handled and logged
 * 3. Multiple rounds execute correctly
 */

describe("GameClient agent loop", () => {
	let ollamaServer: Server<unknown> | null = null;
	let mcpServer: Server<unknown> | null = null;
	let db: GameDatabase | null = null;
	const testInstanceId = "test-agent-loop";
	const dbPath = `data/${testInstanceId}.db`;

	beforeEach(async () => {
		// Clean up any existing test database
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
		
		// Clean up test database
		if (await exists(dbPath)) {
			await unlink(dbPath);
		}
	});

	test("agent loop should continue after text-only LLM response", async () => {
		const llmResponses: Array<{ content: string; tool_calls?: unknown[] }> = [];
		let llmCallCount = 0;
		const maxRounds = 3;

		// Mock Ollama server that tracks calls and returns text-only after first tool call
		ollamaServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				llmCallCount++;
				
				// First call: return a register tool call
				if (llmCallCount === 1) {
					const response = {
						model: "test",
						created_at: new Date().toISOString(),
						message: {
							role: "assistant",
							content: "",
							tool_calls: [{
								function: {
									name: "register",
									arguments: { username: "TestBot", empire: "solarian" }
								}
							}]
						},
						done: true,
					};
					llmResponses.push(response.message);
					return Response.json(response);
				}

				// Subsequent calls: return text-only responses
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

		// Mock MCP server
		mcpServer = Bun.serve({
			port: 0,
			fetch: async (req) => {
				const body = await req.json();
				
				// Handle MCP initialize
				if (body.method === "initialize") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							protocolVersion: "2024-11-05",
							capabilities: { tools: {} },
							serverInfo: { name: "test-mcp", version: "1.0.0" }
						}
					});
				}

				// Handle tools/list
				if (body.method === "tools/list") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							tools: [{
								name: "register",
								description: "Register a new player",
								inputSchema: {
									type: "object",
									properties: {
										username: { type: "string" },
										empire: { type: "string" }
									},
									required: ["username", "empire"]
								}
							}]
						}
					});
				}

				// Handle tool calls - return error for register
				if (body.method === "tools/call") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							content: [{ type: "text", text: JSON.stringify({ error: "username_taken" }) }],
							isError: true
						}
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

		// Override the Ollama client's base URL
		// @ts-expect-error - accessing private property for testing
		client.ollama.updateConfig({ baseUrl: `http://localhost:${ollamaServer.port}` });

		// Start client and let it run for a short time
		const startPromise = client.start();
		
		// Wait for multiple rounds to complete
		await new Promise(resolve => setTimeout(resolve, 3500));
		
		// Stop the client
		await client.stop();

		// CRITICAL ASSERTION: The LLM should have been called multiple times
		// If the loop hangs after the first text-only response, this will fail
		expect(llmCallCount).toBeGreaterThanOrEqual(maxRounds);
		
		// Verify we got text-only responses after the first tool call
		const textOnlyResponses = llmResponses.filter(r => !r.tool_calls || r.tool_calls.length === 0);
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
							serverInfo: { name: "test-mcp", version: "1.0.0" }
						}
					});
				}
				if (body.method === "tools/list") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: { tools: [] }
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

		// @ts-expect-error - accessing private property for testing
		client.ollama.updateConfig({ baseUrl: `http://localhost:${ollamaServer.port}` });

		const startPromise = client.start();
		await new Promise(resolve => setTimeout(resolve, 2500));
		await client.stop();

		console.log = originalLog;

		// Should see multiple LLM calls even when all responses are text-only
		expect(llmCallCount).toBeGreaterThanOrEqual(2);
		
		// Should see "Starting agent loop" log
		expect(logs.some(l => l.includes("Starting agent loop"))).toBe(true);
	});

	test("agent loop should handle LLM timeout gracefully", { timeout: 15000 }, async () => {
		const errors: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) => {
			errors.push(args.join(" "));
			originalError(...args);
		};

		let requestCount = 0;

		// Mock Ollama that takes longer than timeout
		ollamaServer = Bun.serve({
			port: 0,
			fetch: async () => {
				requestCount++;
				// First request times out, subsequent requests succeed
				if (requestCount === 1) {
					await new Promise(resolve => setTimeout(resolve, 2000));
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
							serverInfo: { name: "test-mcp", version: "1.0.0" }
						}
					});
				}
				if (body.method === "tools/list") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: { tools: [] }
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
			ollamaTimeout: 500, // Very short timeout
			serverUrl: `http://localhost:${mcpServer.port}`,
		});

		// @ts-expect-error - accessing private property for testing
		client.ollama.updateConfig({ baseUrl: `http://localhost:${ollamaServer.port}` });

		const startPromise = client.start();
		// Wait long enough for: timeout (500ms) + error delay (5000ms) + next round
		await new Promise(resolve => setTimeout(resolve, 7000));
		await client.stop();

		console.error = originalError;

		// Should have logged an error about timeout
		expect(errors.some(e => e.includes("Agent loop error") || e.includes("timed out"))).toBe(true);
		
		// Should have retried after the timeout error
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
				
				// First 2 calls return empty response (simulating stuck LLM)
				// Third call returns actual content
				if (llmCallCount <= 2) {
					return Response.json({
						model: "test",
						created_at: new Date().toISOString(),
						message: {
							role: "assistant",
							content: "", // Empty response
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
						tool_calls: [{
							function: {
								name: "get_status",
								arguments: {}
							}
						}]
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
							serverInfo: { name: "test-mcp", version: "1.0.0" }
						}
					});
				}
				if (body.method === "tools/list") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							tools: [{
								name: "get_status",
								description: "Get player status",
								inputSchema: { type: "object", properties: {}, required: [] }
							}]
						}
					});
				}
				if (body.method === "tools/call") {
					return Response.json({
						jsonrpc: "2.0",
						id: body.id,
						result: {
							content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }]
						}
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

		// @ts-expect-error - accessing private property for testing
		client.ollama.updateConfig({ baseUrl: `http://localhost:${ollamaServer.port}` });

		const startPromise = client.start();
		await new Promise(resolve => setTimeout(resolve, 2500));
		await client.stop();

		console.log = originalLog;

		// Should have called LLM at least 3 times (2 empty + 1 with content)
		expect(llmCallCount).toBeGreaterThanOrEqual(3);
		
		// Should have logged about empty response
		expect(logs.some(l => l.includes("empty response") || l.includes("nudging"))).toBe(true);
		
		// The nudge message should have been added to the conversation
		const hasNudgeMessage = lastRequestMessages.some((msg: any) => 
			msg.role === "user" && 
			typeof msg.content === "string" && 
			msg.content.includes("didn't take any action")
		);
		expect(hasNudgeMessage).toBe(true);
	});
});
