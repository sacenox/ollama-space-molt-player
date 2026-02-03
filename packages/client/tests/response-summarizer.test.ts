import { describe, expect, test } from "bun:test";
import { summarizeToolResult } from "../src/response-summarizer.ts";

describe("Response Summarizer", () => {
	describe("Error handling", () => {
		test("should preserve error messages in full", () => {
			const errorContent = { error: "not_docked", message: "You must be docked to do this" };
			const result = summarizeToolResult("dock", errorContent, false);
			expect(result).toEqual(errorContent);
		});
	});

	describe("get_status summarization", () => {
		test("should extract essential player and ship info", () => {
			const fullStatus = {
				player: {
					id: "abc123",
					username: "TestPlayer",
					empire: "solarian",
					credits: 1000,
					created_at: "2026-01-01T00:00:00Z",
					last_login_at: "2026-02-03T12:00:00Z",
					last_active_at: "2026-02-03T12:00:00Z",
					status_message: "",
					clan_tag: "",
					primary_color: "#FFFFFF",
					secondary_color: "#000000",
					anonymous: false,
					is_cloaked: false,
					current_ship_id: "ship123",
					current_system: "sol",
					current_poi: "sol_station",
					docked_at_base: "sol_base",
					home_base: "sol_base",
					skills: {},
					skill_xp: {},
					experience: 0,
					stats: {
						credits_earned: 0,
						credits_spent: 0,
						ships_destroyed: 0,
					},
					discovered_systems: {
						sol: { system_id: "sol", discovered_at: "2026-01-01" },
					},
				},
				ship: {
					id: "ship123",
					owner_id: "abc123",
					class_id: "starter_mining",
					name: "Prospector",
					created_at: "2026-01-01T00:00:00Z",
					hull: 100,
					max_hull: 100,
					shield: 50,
					max_shield: 50,
					shield_recharge: 1,
					armor: 5,
					speed: 2,
					fuel: 100,
					max_fuel: 100,
					cargo_used: 10,
					cargo_capacity: 50,
					cpu_used: 2,
					cpu_capacity: 12,
					power_used: 5,
					power_capacity: 25,
					weapon_slots: 1,
					defense_slots: 1,
					utility_slots: 2,
					modules: ["mod1", "mod2"],
					cargo: [],
				},
			};

			const result = summarizeToolResult("get_status", fullStatus, true) as {
				player: Record<string, unknown>;
				ship: Record<string, unknown>;
			};

			expect(result.player.username).toBe("TestPlayer");
			expect(result.player.credits).toBe(1000);
			expect(result.player.current_system).toBe("sol");
			expect(result.player.current_poi).toBe("sol_station");
			expect(result.player.docked_at_base).toBe("sol_base");

			expect(result.player.created_at).toBeUndefined();
			expect(result.player.stats).toBeUndefined();
			expect(result.player.discovered_systems).toBeUndefined();
			expect(result.player.primary_color).toBeUndefined();

			expect(result.ship.name).toBe("Prospector");
			expect(result.ship.hull).toBe(100);
			expect(result.ship.max_hull).toBe(100);
			expect(result.ship.fuel).toBe(100);
			expect(result.ship.max_fuel).toBe(100);
			expect(result.ship.cargo_used).toBe(10);
			expect(result.ship.cargo_capacity).toBe(50);
			expect(result.ship.modules).toEqual(["mod1", "mod2"]);

			expect(result.ship.created_at).toBeUndefined();
		});
	});

	describe("get_nearby summarization", () => {
		test("should limit nearby players and extract key fields", () => {
			const nearby = Array.from({ length: 20 }, (_, i) => ({
				player_id: `player${i}`,
				username: `User${i}`,
				anonymous: false,
				clan_tag: "",
				in_combat: i % 3 === 0,
				primary_color: "#FFFFFF",
				secondary_color: "#000000",
				ship_class: "starter_mining",
				status_message: "",
			}));

			const fullResponse = { count: 20, nearby };

			const result = summarizeToolResult("get_nearby", fullResponse, true) as {
				count: number;
				nearby: Array<Record<string, unknown>>;
			};

			expect(result.count).toBe(20);

			expect(result.nearby.length).toBe(10);

			expect(result.nearby[0].username).toBe("User0");
			expect(result.nearby[0].player_id).toBe("player0");
			expect(result.nearby[0].ship_class).toBe("starter_mining");
			expect(result.nearby[0].in_combat).toBe(true);

			expect(result.nearby[0].primary_color).toBeUndefined();
			expect(result.nearby[0].secondary_color).toBeUndefined();
			expect(result.nearby[0].status_message).toBeUndefined();
		});
	});

	describe("travel summarization", () => {
		test("should extract travel outcome", () => {
			const fullResponse = {
				action: "travel",
				ticks: 3,
				destination: "sol_belt",
				message: "Traveling to Asteroid Belt",
				player: {},
				ship: {},
			};

			const result = summarizeToolResult("travel", fullResponse, true) as Record<string, unknown>;

			expect(result.action).toBe("travel");
			expect(result.ticks).toBe(3);
			expect(result.destination).toBe("sol_belt");
			expect(result.message).toBe("Traveling to Asteroid Belt");

			expect(result.player).toBeUndefined();
			expect(result.ship).toBeUndefined();
		});
	});

	describe("generic summarization", () => {
		test("should remove skip fields from unknown tools", () => {
			const fullResponse = {
				message: "Action completed",
				created_at: "2026-02-03T12:00:00Z",
				timestamp: 1234567890,
				primary_color: "#FFFFFF",
				important_data: "keep this",
			};

			const result = summarizeToolResult("unknown_tool", fullResponse, true) as Record<
				string,
				unknown
			>;

			expect(result.message).toBe("Action completed");
			expect(result.important_data).toBe("keep this");
			expect(result.created_at).toBeUndefined();
			expect(result.timestamp).toBeUndefined();
			expect(result.primary_color).toBeUndefined();
		});

		test("should truncate arrays in generic summarization", () => {
			const fullResponse = {
				items: Array.from({ length: 20 }, (_, i) => ({ id: i, name: `Item${i}` })),
			};

			const result = summarizeToolResult("unknown_tool", fullResponse, true) as {
				items: Array<{ id: number; name: string }>;
			};

			expect(result.items.length).toBe(5);
			expect(result.items[0].name).toBe("Item0");
		});
	});

	describe("register summarization", () => {
		test("should extract essential registration info", () => {
			const fullResponse = {
				message: "Registration successful!",
				player_id: "abc123",
				player: {
					id: "abc123",
					username: "NewPlayer",
					empire: "solarian",
					credits: 100,
					created_at: "2026-02-03T12:00:00Z",
					current_system: "sol",
					current_poi: "sol_station",
					docked_at_base: "sol_base",
				},
				ship: {
					id: "ship123",
					name: "Prospector",
					class_id: "starter_mining",
					hull: 100,
					max_hull: 100,
					fuel: 100,
					max_fuel: 100,
				},
				system: {
					id: "sol",
					name: "Sol",
					description: "Long description here...",
					connections: ["alpha_centauri", "barnard"],
					pois: ["sol_station", "sol_belt"],
				},
				poi: {
					id: "sol_station",
					name: "Sol Central",
					type: "station",
					base_id: "sol_base",
					description: "Long description...",
				},
				token: "secret_token_123",
			};

			const result = summarizeToolResult("register", fullResponse, true) as Record<string, unknown>;

			expect(result.message).toBe("Registration successful!");
			expect(result.player_id).toBe("abc123");
			expect(result.token).toBe("secret_token_123");

			const player = result.player as Record<string, unknown>;
			expect(player.username).toBe("NewPlayer");
			expect(player.empire).toBe("solarian");
			expect(player.current_system).toBe("sol");

			const ship = result.ship as Record<string, unknown>;
			expect(ship.name).toBe("Prospector");
			expect(ship.hull).toBe(100);

			const system = result.system as Record<string, unknown>;
			expect(system.id).toBe("sol");
			expect(system.name).toBe("Sol");
			expect(system.connections).toEqual(["alpha_centauri", "barnard"]);
			expect(system.description).toBeUndefined();
		});
	});
});
