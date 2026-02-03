import { Database } from "bun:sqlite";
import { Glob } from "bun";
import type { AccountDetails, Instance, MessageSender, StoredMessage, Username } from "./types.ts";

const MAX_MESSAGES = 5000;

export class GameDatabase {
	private db: Database;
	private instanceId: string;

	constructor(instanceId: string) {
		this.instanceId = instanceId;
		this.db = new Database(`memory-${instanceId}.sqlite`);
		this.initSchema();
		this.initInstance();
	}

	private initInstance(): void {
		this.db.run("INSERT OR IGNORE INTO instances (instance_id, hint) VALUES (?, NULL)", [
			this.instanceId,
		]);
	}

	private initSchema(): void {
		this.db.run(`
			CREATE TABLE IF NOT EXISTS instances (
				instance_id TEXT PRIMARY KEY,
				hint TEXT
			)
		`);

		this.db.run(`
			CREATE TABLE IF NOT EXISTS usernames (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT NOT NULL,
				token TEXT NOT NULL,
				prompt TEXT NOT NULL,
				player_id TEXT NOT NULL,
				instance_id TEXT NOT NULL,
				last_used_on INTEGER NOT NULL,
				FOREIGN KEY (instance_id) REFERENCES instances(instance_id)
			)
		`);

		this.db.run(`
			CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tick INTEGER NOT NULL,
				sender TEXT NOT NULL CHECK(sender IN ('server', 'client')),
				data TEXT NOT NULL
			)
		`);

		this.db.run(`
			CREATE INDEX IF NOT EXISTS idx_messages_tick 
			ON messages(tick DESC)
		`);

		this.db.run(`
			CREATE TRIGGER IF NOT EXISTS truncate_messages
			AFTER INSERT ON messages
			BEGIN
				DELETE FROM messages
				WHERE id IN (
					SELECT id FROM messages
					ORDER BY tick ASC
					LIMIT MAX(0, (SELECT COUNT(*) FROM messages) - ${MAX_MESSAGES})
				);
			END
		`);
	}

	saveUsername(
		username: string,
		token: string,
		prompt: string,
		playerId: string,
		tick: number,
	): void {
		this.db.run(
			`INSERT INTO usernames (username, token, prompt, player_id, instance_id, last_used_on) 
			VALUES (?, ?, ?, ?, ?, ?)`,
			[username, token, prompt, playerId, this.instanceId, tick],
		);
	}

	getUsernames(): Username[] {
		const rows = this.db
			.query<
				Username,
				[]
			>("SELECT id, username, token, prompt, player_id, instance_id, last_used_on FROM usernames ORDER BY last_used_on DESC")
			.all();
		return rows;
	}

	getActiveUsername(): Username | null {
		const row = this.db
			.query<
				Username,
				[]
			>("SELECT id, username, token, prompt, player_id, instance_id, last_used_on FROM usernames ORDER BY last_used_on DESC LIMIT 1")
			.get();
		return row || null;
	}

	updateUsernamePrompt(username: string, prompt: string): void {
		this.db.run("UPDATE usernames SET prompt = ? WHERE username = ?", [prompt, username]);
	}

	updateUsernameLastUsed(username: string, tick: number): void {
		this.db.run("UPDATE usernames SET last_used_on = ? WHERE username = ?", [tick, username]);
	}

	getInstance(): Instance {
		const row = this.db
			.query<Instance, [string]>("SELECT instance_id, hint FROM instances WHERE instance_id = ?")
			.get(this.instanceId);
		if (!row) {
			throw new Error(`Instance ${this.instanceId} not found`);
		}
		return row;
	}

	updateHint(hint: string): void {
		this.db.run("UPDATE instances SET hint = ? WHERE instance_id = ?", [hint, this.instanceId]);
	}

	saveMessage(tick: number, sender: MessageSender, data: object): void {
		this.db.run("INSERT INTO messages (tick, sender, data) VALUES (?, ?, ?)", [
			tick,
			sender,
			JSON.stringify(data),
		]);
	}

	getMessages(limit = MAX_MESSAGES): StoredMessage[] {
		const rows = this.db
			.query<
				{ id: number; tick: number; sender: MessageSender; data: string },
				[number]
			>("SELECT id, tick, sender, data FROM messages ORDER BY tick DESC LIMIT ?")
			.all(limit);

		return rows.map((row) => ({
			id: row.id,
			tick: row.tick,
			sender: row.sender,
			data: row.data,
		}));
	}

	getMessageCount(): number {
		const result = this.db
			.query<{ count: number }, []>("SELECT COUNT(*) as count FROM messages")
			.get();
		return result?.count || 0;
	}

	clearMessages(): void {
		this.db.run("DELETE FROM messages");
	}

	close(): void {
		this.db.close();
	}

	getInstanceId(): string {
		return this.instanceId;
	}
}

export function generateInstanceId(): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function listInstances(): string[] {
	const glob = new Glob("memory-*.sqlite");
	const files = Array.from(glob.scanSync("."));
	return files.map((f: string) => f.slice(7, -7));
}

export async function instanceExists(instanceId: string): Promise<boolean> {
	const file = Bun.file(`memory-${instanceId}.sqlite`);
	return await file.exists();
}
