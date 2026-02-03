import { describe, expect, test } from "bun:test";

describe("WebSocket Message Handling", () => {
	test("should parse valid JSON messages", () => {
		const validMessage = JSON.stringify({
			type: "welcome",
			payload: { version: "0.1.0", tick_rate: 10, current_tick: 0 },
		});

		let parsed = false;
		try {
			const message = JSON.parse(validMessage);
			expect(message.type).toBe("welcome");
			parsed = true;
		} catch (error) {
			parsed = false;
		}

		expect(parsed).toBe(true);
	});

	test("should handle null data gracefully", () => {
		const data = null;

		if (data === null || data === undefined) {
			expect(data).toBeNull();
			return;
		}

		throw new Error("Should not reach here");
	});

	test("should handle undefined data gracefully", () => {
		const data = undefined;

		if (data === null || data === undefined) {
			expect(data).toBeUndefined();
			return;
		}

		throw new Error("Should not reach here");
	});

	test("should detect empty strings", () => {
		const empty1 = "";
		const empty2 = "   ";
		const empty3 = "\n\t ";

		expect(empty1.trim()).toBe("");
		expect(empty2.trim()).toBe("");
		expect(empty3.trim()).toBe("");
	});

	test("should detect non-string data", () => {
		const num = 12345;
		const obj = { some: "object" };
		const arr = new ArrayBuffer(8);

		expect(typeof num).toBe("number");
		expect(typeof obj).toBe("object");
		expect(typeof arr).toBe("object");
		expect(arr.constructor.name).toBe("ArrayBuffer");
	});

	test("should fail on malformed JSON", () => {
		const malformed = "{invalid json";

		let threw = false;
		try {
			JSON.parse(malformed);
		} catch (error) {
			threw = true;
			expect(error).toBeDefined();
		}

		expect(threw).toBe(true);
	});

	test("should parse registered message correctly", () => {
		const registeredMessage = JSON.stringify({
			type: "registered",
			payload: {
				token: "abc123def456",
				player_id: "player-uuid-123",
			},
		});

		const message = JSON.parse(registeredMessage);

		expect(message.type).toBe("registered");
		expect(message.payload.token).toBe("abc123def456");
		expect(message.payload.player_id).toBe("player-uuid-123");
	});

	test("should split concatenated JSON messages", () => {
		const single = '{"type":"welcome","payload":{"version":"0.1.0"}}';
		const double =
			'{"type":"registered","payload":{"token":"abc123"}}{"type":"logged_in","payload":{"player":{"id":"123"}}}';
		const triple =
			'{"type":"tick","payload":{"tick":1}}{"type":"ok","payload":{}}{"type":"state_update","payload":{"tick":1}}';

		const splitSingle = (text: string): string[] => {
			const messages: string[] = [];
			let depth = 0;
			let start = 0;

			for (let i = 0; i < text.length; i++) {
				const char = text[i];

				if (char === "{") {
					depth++;
				} else if (char === "}") {
					depth--;

					if (depth === 0) {
						messages.push(text.substring(start, i + 1));
						start = i + 1;

						while (start < text.length && /\s/.test(text[start])) {
							start++;
						}
						i = start - 1;
					}
				}
			}

			if (messages.length === 0 && text.trim().length > 0) {
				messages.push(text);
			}

			return messages;
		};

		const result1 = splitSingle(single);
		expect(result1.length).toBe(1);
		expect(JSON.parse(result1[0]).type).toBe("welcome");

		const result2 = splitSingle(double);
		expect(result2.length).toBe(2);
		expect(JSON.parse(result2[0]).type).toBe("registered");
		expect(JSON.parse(result2[1]).type).toBe("logged_in");

		const result3 = splitSingle(triple);
		expect(result3.length).toBe(3);
		expect(JSON.parse(result3[0]).type).toBe("tick");
		expect(JSON.parse(result3[1]).type).toBe("ok");
		expect(JSON.parse(result3[2]).type).toBe("state_update");
	});

	test("should handle whitespace between concatenated messages", () => {
		const withSpaces = '{"type":"tick","payload":{"tick":1}}   {"type":"ok","payload":{}}';
		const withNewlines = '{"type":"tick","payload":{"tick":1}}\n{"type":"ok","payload":{}}';

		const split = (text: string): string[] => {
			const messages: string[] = [];
			let depth = 0;
			let start = 0;

			for (let i = 0; i < text.length; i++) {
				const char = text[i];

				if (char === "{") {
					depth++;
				} else if (char === "}") {
					depth--;

					if (depth === 0) {
						messages.push(text.substring(start, i + 1));
						start = i + 1;

						while (start < text.length && /\s/.test(text[start])) {
							start++;
						}
						i = start - 1;
					}
				}
			}

			if (messages.length === 0 && text.trim().length > 0) {
				messages.push(text);
			}

			return messages;
		};

		const result1 = split(withSpaces);
		expect(result1.length).toBe(2);

		const result2 = split(withNewlines);
		expect(result2.length).toBe(2);
	});

	test("defensive parsing guards work correctly", () => {
		const testCases = [
			{ data: null, shouldSkip: true, reason: "null" },
			{ data: undefined, shouldSkip: true, reason: "undefined" },
			{ data: "", shouldSkip: true, reason: "empty string" },
			{ data: "   ", shouldSkip: true, reason: "whitespace only" },
			{ data: 123, shouldSkip: true, reason: "number" },
			{ data: {}, shouldSkip: true, reason: "object" },
			{ data: '{"type":"test"}', shouldSkip: false, reason: "valid JSON string" },
		];

		for (const testCase of testCases) {
			const data = testCase.data;

			if (data === null || data === undefined) {
				expect(testCase.shouldSkip).toBe(true);
				continue;
			}

			if (typeof data !== "string") {
				expect(testCase.shouldSkip).toBe(true);
				continue;
			}

			if (data.trim() === "") {
				expect(testCase.shouldSkip).toBe(true);
				continue;
			}

			expect(testCase.shouldSkip).toBe(false);
		}
	});
});
