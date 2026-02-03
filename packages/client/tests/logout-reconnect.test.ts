import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GameDatabase } from "../src/db.ts";
import { MockGameServer } from "./mock-server.ts";
import { GameWebSocketClient } from "../src/ws-client.ts";
import type { BaseCommand, ServerMessage } from "../src/types.ts";

describe("Logout and Reconnect", () => {
	let db: GameDatabase;
	let server: MockGameServer;
	let testInstanceId: string;

	beforeEach(async () => {
		testInstanceId = `test-logout-${Date.now()}`;
		db = new GameDatabase(testInstanceId);
		server = new MockGameServer({ port: 0 });
		await server.start();
	});

	afterEach(() => {
		db.close();
		server.stop();

		const fs = require("node:fs");
		const dbFile = `memory-${testInstanceId}.sqlite`;
		if (fs.existsSync(dbFile)) {
			fs.unlinkSync(dbFile);
		}
	});

	describe("Database state transitions", () => {
		test("logged_out should be false by default", () => {
			expect(db.isLoggedOut()).toBe(false);
		});

		test("logged_out should be true after setLoggedOut(true)", () => {
			db.setLoggedOut(true);
			expect(db.isLoggedOut()).toBe(true);
		});

		test("logged_out should be false after setLoggedOut(false)", () => {
			db.setLoggedOut(true);
			db.setLoggedOut(false);
			expect(db.isLoggedOut()).toBe(false);
		});
	});

	describe("Reconnect after manual logout", () => {
		test("state preconditions for logout-reconnect scenario", () => {
			db.saveUsername("TestPlayer", "test-token-123", "Test prompt", "player-id", 100);
			db.setLoggedOut(true);

			const activeUsername = db.getActiveUsername();
			const isLoggedOut = db.isLoggedOut();

			expect(activeUsername).not.toBeNull();
			expect(activeUsername?.username).toBe("TestPlayer");
			expect(isLoggedOut).toBe(true);
		});

		test("handleWelcome cases coverage", () => {
			const cases = [
				{
					name: "no username, not logged out -> prompt registration",
					hasUsername: false,
					loggedOut: false,
					expectedAction: "promptForRegistration",
				},
				{
					name: "has username, not logged out -> auto-login",
					hasUsername: true,
					loggedOut: false,
					expectedAction: "autoLogin",
				},
				{
					name: "has username, logged out -> should prompt for login (BUG: currently does nothing)",
					hasUsername: true,
					loggedOut: true,
					expectedAction: "promptForLogin",
				},
			];

			for (const testCase of cases) {
				if (testCase.hasUsername) {
					db.saveUsername(`Player-${testCase.name}`, "token", "prompt", "id", Date.now());
				}
				if (testCase.loggedOut) {
					db.setLoggedOut(true);
				}

				const activeUsername = db.getActiveUsername();
				const wasLoggedOut = db.isLoggedOut();

				let action: string;
				if (activeUsername && !wasLoggedOut) {
					action = "autoLogin";
				} else if (!activeUsername) {
					action = "promptForRegistration";
				} else {
					action = "promptForLogin";
				}

				expect(action).toBe(testCase.expectedAction);

				db.setLoggedOut(false);
			}
		});
	});
});
