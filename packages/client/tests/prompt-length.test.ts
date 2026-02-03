import { afterAll, describe, expect, test } from "bun:test";
import { GameClient } from "../src/game-client.ts";
import { GameDatabase } from "../src/db.ts";
import type { ClientConfig } from "../src/types.ts";

describe("Prompt Length", () => {
	const testInstanceId = "prompt-len-test";

	function createTestClient(): GameClient {
		const db = new GameDatabase(testInstanceId);
		const config: ClientConfig = {
			instanceId: testInstanceId,
			model: "qwen3:8b",
			temperature: 1.2,
			thinking: false,
			tickRate: 10000,
			ollamaTimeout: 30000,
		};
		return new GameClient(db, config);
	}

	afterAll(async () => {
		const fs = await import("fs");
		const filePath = `memory-${testInstanceId}.sqlite`;
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	});

	test("prompt with 10 history messages using compact JSON", () => {
		const client = createTestClient();
		const db = new GameDatabase(testInstanceId);

		db.saveUsername(
			"test_player",
			"test_token_123",
			"You are a strategic trader seeking profit in the SpaceMolt universe.",
			"player_123",
			1,
		);
		db.updateHint("Focus on mining and trading");

		for (let i = 1; i <= 10; i++) {
			db.saveMessage(i, "server", {
				type: "state_update",
				payload: {
					tick: i,
					player: {
						id: "player_123",
						username: "test_player",
						empire: "solarian",
						credits: 5000 + i * 100,
						current_system: "sol",
						current_poi: "sol_station_alpha",
						current_ship_id: "ship_123",
						home_base: "sol_station_alpha",
						docked_at_base: null,
						faction_id: null,
						faction_rank: null,
						status_message: "Mining the void",
						clan_tag: "",
						primary_color: "#ffffff",
						secondary_color: "#000000",
						anonymous: false,
						skills: {
							mining: { level: 2, xp: 150 },
						},
						stats: {
							ships_destroyed: 0,
							times_destroyed: 0,
							ore_mined: 100,
							credits_earned: 1000,
							credits_spent: 500,
							trades_completed: 5,
							systems_discovered: 1,
							items_crafted: 0,
							missions_completed: 0,
						},
					},
					ship: {
						id: "ship_123",
						owner_id: "player_123",
						class_id: "starter_ship",
						name: "Starter Ship",
						hull: 100,
						max_hull: 100,
						shield: 50,
						max_shield: 50,
						shield_recharge: 5,
						armor: 10,
						speed: 3,
						fuel: 80,
						max_fuel: 100,
						cargo_used: 25,
						cargo_capacity: 100,
						cpu_used: 20,
						cpu_capacity: 50,
						power_used: 15,
						power_capacity: 40,
						modules: ["mining_laser_1"],
						cargo: [{ item_id: "iron_ore", quantity: 25 }],
					},
					nearby: [],
					in_combat: false,
				},
			});

			db.saveMessage(i, "client", {
				type: "mine",
				payload: {},
			});
		}

		const context = (client as any).buildLLMContext(
			"You are a strategic trader seeking profit in the SpaceMolt universe.",
			"Focus on mining and trading",
		);

		const contextJson = JSON.stringify(context);
		const fullPrompt = `You are a SpaceMolt player. You receive game context and must respond with a single JSON action.

Game Context:
${contextJson}

Respond with ONLY a JSON command in this exact format:
{"type": "action_name", "payload": {...}}

Your response (JSON only):`;

		console.log(`\n=== COMPACT JSON Analysis ===`);
		console.log(`Full prompt length: ${fullPrompt.length} characters`);
		console.log(`Context JSON length: ${contextJson.length} characters`);
		console.log(`API definition size: ${JSON.stringify(context.api).length} characters`);
		console.log(`History messages count: ${context.recent_game_messages.length}`);
		console.log(
			`Average per history message: ${Math.round(JSON.stringify(context.recent_game_messages).length / context.recent_game_messages.length)} characters`,
		);

		if (fullPrompt.length < 4096) {
			console.log(`✅ UNDER 4096 character limit!`);
		} else {
			console.log(
				`❌ Over limit by ${fullPrompt.length - 4096} characters (${Math.round((fullPrompt.length / 4096) * 100)}%)`,
			);
		}

		expect(fullPrompt.length).toBeLessThan(25000);

		db.close();
	});

	test("prompt structure includes all required fields", () => {
		const client = createTestClient();
		const db = new GameDatabase(testInstanceId);

		db.saveUsername("test_player", "test_token_123", "Test prompt", "player_123", 1);
		db.updateHint("Test hint");

		db.saveMessage(1, "server", {
			type: "welcome",
			payload: {
				version: "0.8.3",
				release_date: "2024-01-01",
				release_notes: [],
				tick_rate: 10,
				current_tick: 1,
				server_time: Date.now(),
				game_info: "SpaceMolt",
				website: "https://www.spacemolt.com",
				help_text: "Help",
				terms: "Terms",
			},
		});

		const context = (client as any).buildLLMContext("Test prompt", "Test hint");

		expect(context).toHaveProperty("character");
		expect(context).toHaveProperty("hint");
		expect(context).toHaveProperty("recent_game_messages");
		expect(context).toHaveProperty("api");
		expect(context.character).toBe("Test prompt");
		expect(context.hint).toBe("Test hint");
		expect(Array.isArray(context.recent_game_messages)).toBe(true);
		expect(context.recent_game_messages.length).toBeGreaterThan(0);
		expect(typeof context.api).toBe("object");

		db.close();
	});

	test("prompt with maximum size messages is bounded", () => {
		const client = createTestClient();
		const db = new GameDatabase(testInstanceId);

		const longString = "x".repeat(100);
		const longPrompt = `You are ${longString} seeking to explore the universe.`;
		const longHint = `Focus on ${longString} and always prioritize safety.`;

		db.saveUsername("test_player", "test_token_123", longPrompt, "player_123", 1);
		db.updateHint(longHint);

		for (let i = 1; i <= 10; i++) {
			db.saveMessage(i, "server", {
				type: "chat_message",
				payload: {
					id: `msg_${i}`,
					channel: "system",
					sender_id: "system",
					sender: "System",
					content: longString,
					timestamp: new Date().toISOString(),
				},
			});

			db.saveMessage(i, "client", {
				type: "help",
				payload: { topic: longString },
			});
		}

		const context = (client as any).buildLLMContext(longPrompt, longHint);
		const contextJson = JSON.stringify(context);
		const fullPrompt = `You are a SpaceMolt player. You receive game context and must respond with a single JSON action.

Game Context:
${contextJson}

Respond with ONLY a JSON command in this exact format:
{"type": "action_name", "payload": {...}}

Your response (JSON only):`;

		console.log(`\n=== STRESS TEST (Max Size) ===`);
		console.log(`Full prompt length: ${fullPrompt.length} characters`);

		if (fullPrompt.length < 4096) {
			console.log(`✅ Even with max size, under 4096 limit!`);
		} else {
			console.log(`❌ Over limit by ${fullPrompt.length - 4096} characters`);
		}

		expect(fullPrompt.length).toBeLessThan(30000);

		db.close();
	});
});
