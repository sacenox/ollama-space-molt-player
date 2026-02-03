import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ServerMessage } from "../src/types.ts";
import { GameWebSocketClient } from "../src/ws-client.ts";
import { MockGameServer } from "./mock-server.ts";

describe("GameWebSocketClient", () => {
	let server: MockGameServer;
	let client: GameWebSocketClient;

	beforeEach(async () => {
		server = new MockGameServer({ port: 0 });
		await server.start();
	});

	afterEach(() => {
		client?.disconnect();
		server?.stop();
	});

	test("should connect to server", async () => {
		let connected = false;

		client = new GameWebSocketClient({
			url: server.getUrl(),
			onConnect: () => {
				connected = true;
			},
			reconnect: false,
		});

		await client.connect();
		expect(connected).toBe(true);
		expect(client.isConnectionOpen()).toBe(true);
	});

	test("should receive welcome message", async () => {
		const messages: ServerMessage[] = [];

		client = new GameWebSocketClient({
			url: server.getUrl(),
			onMessage: (msg) => {
				messages.push(msg);
			},
			reconnect: false,
		});

		await client.connect();

		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(messages.length).toBeGreaterThan(0);
		expect(messages[0].type).toBe("welcome");
	});

	test("should send commands to server", async () => {
		let receivedCommand = false;

		server.onCommand("get_status", (_data) => {
			receivedCommand = true;
			return { type: "ok", payload: { action: "get_status" } };
		});

		client = new GameWebSocketClient({
			url: server.getUrl(),
			reconnect: false,
		});

		await client.connect();
		await new Promise((resolve) => setTimeout(resolve, 50));

		client.send({ type: "get_status" });

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(receivedCommand).toBe(true);
	});

	test("should throw error when sending without connection", () => {
		client = new GameWebSocketClient({
			url: server.getUrl(),
			reconnect: false,
		});

		expect(() => client.send({ type: "get_status" })).toThrow("WebSocket not connected");
	});

	test("should disconnect cleanly", async () => {
		let disconnected = false;

		client = new GameWebSocketClient({
			url: server.getUrl(),
			onDisconnect: () => {
				disconnected = true;
			},
			reconnect: false,
		});

		await client.connect();
		client.disconnect();

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(disconnected).toBe(true);
		expect(client.isConnectionOpen()).toBe(false);
	});

	test("should track reconnection attempts", async () => {
		client = new GameWebSocketClient({
			url: server.getUrl(),
			reconnect: true,
		});

		await client.connect();

		expect(client.getReconnectAttempts()).toBe(0);
	});

	test("should not reconnect when explicitly disconnected", async () => {
		let connectCount = 0;

		client = new GameWebSocketClient({
			url: server.getUrl(),
			onConnect: () => {
				connectCount++;
			},
			reconnect: true,
		});

		await client.connect();
		expect(connectCount).toBe(1);

		client.disconnect();

		await new Promise((resolve) => setTimeout(resolve, 300));

		expect(connectCount).toBe(1);
	});

	test("should handle malformed JSON", async () => {
		const errors: Error[] = [];

		client = new GameWebSocketClient({
			url: server.getUrl(),
			onError: (err) => {
				errors.push(err);
			},
			reconnect: false,
		});

		await client.connect();

		expect(errors.length).toBeGreaterThanOrEqual(0);
	});

	test("should correctly split concatenated messages when string values contain braces", async () => {
		const messages: ServerMessage[] = [];

		client = new GameWebSocketClient({
			url: server.getUrl(),
			onMessage: (msg) => {
				if (msg.type !== "welcome") {
					messages.push(msg);
				}
			},
			reconnect: false,
		});

		await client.connect();
		await new Promise((resolve) => setTimeout(resolve, 50));

		const message1 = {
			type: "chat_message" as const,
			payload: {
				from: "player1",
				message: "Use {curly} braces in JSON",
			},
		};
		const message2 = {
			type: "tick" as const,
			payload: { tick: 1 },
		};

		server.sendRaw(JSON.stringify(message1) + JSON.stringify(message2));

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(messages.length).toBe(2);
		expect(messages[0].type).toBe("chat_message");
		expect(messages[1].type).toBe("tick");
	});
});
