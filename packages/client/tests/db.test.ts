import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GameDatabase, generateInstanceId, instanceExists, listInstances } from "../src/db.ts";
import type { AccountDetails } from "../src/types.ts";

describe("GameDatabase", () => {
	let db: GameDatabase;
	let testInstanceId: string;

	beforeEach(() => {
		testInstanceId = `test-${Date.now()}`;
		db = new GameDatabase(testInstanceId);
	});

	afterEach(() => {
		db.close();

		const fs = require("node:fs");
		const dbFile = `memory-${testInstanceId}.sqlite`;
		if (fs.existsSync(dbFile)) {
			fs.unlinkSync(dbFile);
		}
	});

	describe("Instance Operations", () => {
		test("should retrieve instance with hint", () => {
			const instance = db.getInstance();
			expect(instance.instance_id).toBe(testInstanceId);
			expect(instance.hint).toBeNull();
		});

		test("should update hint", () => {
			db.updateHint("new hint");
			const instance = db.getInstance();
			expect(instance.hint).toBe("new hint");
		});
	});

	describe("Username Operations", () => {
		test("should save and retrieve username", () => {
			db.saveUsername("TestPlayer", "test-token-123", "Test prompt", "player-uuid", 100);

			const usernames = db.getUsernames();
			expect(usernames.length).toBe(1);
			expect(usernames[0].username).toBe("TestPlayer");
			expect(usernames[0].token).toBe("test-token-123");
			expect(usernames[0].prompt).toBe("Test prompt");
			expect(usernames[0].player_id).toBe("player-uuid");
			expect(usernames[0].last_used_on).toBe(100);
		});

		test("should return empty array when no usernames exist", () => {
			const usernames = db.getUsernames();
			expect(usernames.length).toBe(0);
		});

		test("should get active username (most recent)", () => {
			db.saveUsername("Player1", "token1", "prompt1", "id1", 100);
			db.saveUsername("Player2", "token2", "prompt2", "id2", 200);
			db.saveUsername("Player3", "token3", "prompt3", "id3", 150);

			const active = db.getActiveUsername();
			expect(active?.username).toBe("Player2");
			expect(active?.last_used_on).toBe(200);
		});

		test("should return null when no active username", () => {
			const active = db.getActiveUsername();
			expect(active).toBeNull();
		});

		test("should update username prompt", () => {
			db.saveUsername("TestPlayer", "token", "original prompt", "id", 100);
			db.updateUsernamePrompt("TestPlayer", "updated prompt");

			const usernames = db.getUsernames();
			expect(usernames[0].prompt).toBe("updated prompt");
		});

		test("should update username last_used_on", () => {
			db.saveUsername("TestPlayer", "token", "prompt", "id", 100);
			db.updateUsernameLastUsed("TestPlayer", 200);

			const active = db.getActiveUsername();
			expect(active?.last_used_on).toBe(200);
		});

		test("should return usernames sorted by last_used_on", () => {
			db.saveUsername("Player1", "token1", "prompt1", "id1", 100);
			db.saveUsername("Player2", "token2", "prompt2", "id2", 300);
			db.saveUsername("Player3", "token3", "prompt3", "id3", 200);

			const usernames = db.getUsernames();
			expect(usernames.length).toBe(3);
			expect(usernames[0].username).toBe("Player2");
			expect(usernames[1].username).toBe("Player3");
			expect(usernames[2].username).toBe("Player1");
		});
	});

	describe("Message Operations", () => {
		test("should save and retrieve messages", () => {
			db.saveMessage(1, "server", { type: "tick", payload: { tick: 1 } });
			db.saveMessage(2, "client", { type: "get_status" });

			const messages = db.getMessages();

			expect(messages.length).toBe(2);
			expect(messages[0].tick).toBe(2);
			expect(messages[0].sender).toBe("client");
			expect(messages[1].tick).toBe(1);
			expect(messages[1].sender).toBe("server");
		});

		test("should parse JSON data correctly", () => {
			const data = { type: "tick", payload: { tick: 42 } };
			db.saveMessage(42, "server", data);

			const messages = db.getMessages();
			const retrieved = JSON.parse(messages[0].data);

			expect(retrieved).toEqual(data);
		});

		test("should get message count", () => {
			expect(db.getMessageCount()).toBe(0);

			db.saveMessage(1, "server", { type: "tick" });
			expect(db.getMessageCount()).toBe(1);

			db.saveMessage(2, "server", { type: "tick" });
			expect(db.getMessageCount()).toBe(2);
		});

		test("should limit retrieved messages", () => {
			for (let i = 0; i < 100; i++) {
				db.saveMessage(i, "server", { type: "tick" });
			}

			const messages = db.getMessages(10);
			expect(messages.length).toBe(10);
		});

		test("should clear all messages", () => {
			db.saveMessage(1, "server", { type: "tick" });
			db.saveMessage(2, "server", { type: "tick" });

			db.clearMessages();
			expect(db.getMessageCount()).toBe(0);
		});
	});

	describe("Utility", () => {
		test("should return instance ID", () => {
			expect(db.getInstanceId()).toBe(testInstanceId);
		});

		test("should close database", () => {
			expect(() => db.close()).not.toThrow();
		});
	});
});

describe("Instance Management", () => {
	test("should generate 4-character instance ID", () => {
		const id = generateInstanceId();
		expect(id.length).toBe(4);
		expect(/^[a-z0-9]{4}$/.test(id)).toBe(true);
	});

	test("should generate unique IDs", () => {
		const ids = new Set();
		for (let i = 0; i < 100; i++) {
			ids.add(generateInstanceId());
		}
		expect(ids.size).toBeGreaterThan(90);
	});

	test("should check if instance exists", async () => {
		const id = `test-exists-${Date.now()}`;
		expect(await instanceExists(id)).toBe(false);

		const db = new GameDatabase(id);
		expect(await instanceExists(id)).toBe(true);

		db.close();
		const fs = require("node:fs");
		fs.unlinkSync(`memory-${id}.sqlite`);
	});

	test("should list existing instances", () => {
		const id1 = `test-list-${Date.now()}-1`;
		const id2 = `test-list-${Date.now()}-2`;

		const db1 = new GameDatabase(id1);
		const db2 = new GameDatabase(id2);

		const instances = listInstances();
		expect(instances).toContain(id1);
		expect(instances).toContain(id2);

		db1.close();
		db2.close();

		const fs = require("node:fs");
		fs.unlinkSync(`memory-${id1}.sqlite`);
		fs.unlinkSync(`memory-${id2}.sqlite`);
	});
});
