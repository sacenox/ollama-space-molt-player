import { afterAll, describe, expect, test } from "bun:test";
import { GameClient } from "../src/game-client.ts";
import { GameDatabase } from "../src/db.ts";
import type { ClientConfig } from "../src/types.ts";

describe("JSON Extraction", () => {
	const testInstanceId = "json-test";

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

	test("should extract JSON from plain response", () => {
		const client = createTestClient();
		const response = '{"type":"help","payload":{}}';
		const result = (client as any).extractJSON(response);
		expect(result.type).toBe("help");
	});

	test("should extract JSON from markdown code block", () => {
		const client = createTestClient();
		const response = '```json\n{"type":"help","payload":{}}\n```';
		const result = (client as any).extractJSON(response);
		expect(result.type).toBe("help");
	});

	test("should extract JSON from code block without language", () => {
		const client = createTestClient();
		const response = '```\n{"type":"help","payload":{}}\n```';
		const result = (client as any).extractJSON(response);
		expect(result.type).toBe("help");
	});

	test("should extract JSON from line with text around it", () => {
		const client = createTestClient();
		const response = 'Here is the command:\n{"type":"help","payload":{}}\nThis should work.';
		const result = (client as any).extractJSON(response);
		expect(result.type).toBe("help");
	});

	test("should extract nested JSON", () => {
		const client = createTestClient();
		const response = '{"type":"register","payload":{"username":"test","empire":"solarian"}}';
		const result = (client as any).extractJSON(response);
		expect(result.type).toBe("register");
		expect((result.payload as any).username).toBe("test");
	});

	test("should handle JSON with line breaks", () => {
		const client = createTestClient();
		const response = `{
  "type": "help",
  "payload": {}
}`;
		const result = (client as any).extractJSON(response);
		expect(result.type).toBe("help");
	});

	test("should throw error on invalid JSON", () => {
		const client = createTestClient();
		const response = "This is not JSON at all";
		expect(() => (client as any).extractJSON(response)).toThrow(
			"Response does not contain valid JSON command",
		);
	});

	test("should throw error on malformed JSON", () => {
		const client = createTestClient();
		const response = '{"type":"help" missing brace';
		expect(() => (client as any).extractJSON(response)).toThrow(
			"Response does not contain valid JSON command",
		);
	});

	test("should handle JSON with trailing text", () => {
		const client = createTestClient();
		const response = '{"type":"help","payload":{}} // This is a help command';
		const result = (client as any).extractJSON(response);
		expect(result.type).toBe("help");
	});

	test("should prefer code block over inline JSON", () => {
		const client = createTestClient();
		const response =
			'Ignore this {"type":"wrong","payload":{}} and use this:\n```json\n{"type":"correct","payload":{}}\n```';
		const result = (client as any).extractJSON(response);
		expect(result.type).toBe("correct");
	});
});
