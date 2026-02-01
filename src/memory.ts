import { Database } from "bun:sqlite";

export interface Snapshot {
	tick: number;
	player: unknown;
	ship: unknown;
	system: unknown;
	poi: unknown;
	base: unknown;
	nearby: unknown;
}

export interface StoredAction {
	id: number;
	ts: string;
	action: string;
	args: string | null;
	prompt_excerpt: string | null;
	model_raw: string | null;
}

export interface StoredEvent {
	id: number;
	ts: string;
	type: string;
	payload: string | null;
}

export type HistoryEntry =
	| {
			kind: "action";
			ts: string;
			action: string;
			args: string | null;
	  }
	| {
			kind: "event";
			ts: string;
			type: string;
			payload: string | null;
	  };

const MAX_TEXT = 2000;

export class MemoryStore {
	private db: Database;

	constructor(path: string) {
		this.db = new Database(path);
		this.init();
	}

	private init(): void {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        action TEXT NOT NULL,
        args TEXT,
        prompt_excerpt TEXT,
        model_raw TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT
      );
      CREATE TABLE IF NOT EXISTS llm_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        username TEXT NOT NULL,
        goal TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS state_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        tick INTEGER,
        player TEXT,
        ship TEXT,
        system TEXT,
        poi TEXT,
        base TEXT,
        nearby TEXT
      );
    `);
	}

	appendAction(
		action: string,
		args: unknown,
		promptExcerpt: string,
		modelRaw: string,
	): void {
		this.db
			.query(
				"INSERT INTO actions (ts, action, args, prompt_excerpt, model_raw) VALUES (?, ?, ?, ?, ?)",
			)
			.run(
				nowIso(),
				action,
				toJson(args),
				truncate(promptExcerpt),
				truncate(modelRaw),
			);
	}

	appendEvent(type: string, payload: unknown): void {
		this.db
			.query("INSERT INTO events (ts, type, payload) VALUES (?, ?, ?)")
			.run(nowIso(), type, toJson(payload));
	}

	saveSnapshot(snapshot: Snapshot): void {
		this.db
			.query(
				"INSERT INTO state_snapshots (ts, tick, player, ship, system, poi, base, nearby) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.run(
				nowIso(),
				snapshot.tick,
				toJson(snapshot.player),
				toJson(snapshot.ship),
				toJson(snapshot.system),
				toJson(snapshot.poi),
				toJson(snapshot.base),
				toJson(snapshot.nearby),
			);
	}

	setGoal(username: string, goal: string): void {
		this.db
			.query("INSERT INTO llm_goals (ts, username, goal) VALUES (?, ?, ?)")
			.run(nowIso(), username, goal);
	}

	getLatestGoal(username: string): string | null {
		const row = this.db
			.query(
				"SELECT goal FROM llm_goals WHERE username = ? ORDER BY id DESC LIMIT 1",
			)
			.get(username) as { goal?: string } | undefined;
		if (!row || !row.goal) return null;
		return row.goal;
	}

	getRecentActions(limit: number): StoredAction[] {
		const rows = this.db
			.query(
				"SELECT id, ts, action, args, prompt_excerpt, model_raw FROM actions ORDER BY id DESC LIMIT ?",
			)
			.all(limit) as StoredAction[];
		return rows.reverse();
	}

	getRecentEvents(limit: number): StoredEvent[] {
		const rows = this.db
			.query(
				"SELECT id, ts, type, payload FROM events ORDER BY id DESC LIMIT ?",
			)
			.all(limit) as StoredEvent[];
		return rows.reverse();
	}

	getRecentHistory(actionLimit: number, eventLimit: number): HistoryEntry[] {
		const actions = this.getRecentActions(actionLimit).map((row) => ({
			kind: "action" as const,
			ts: row.ts,
			action: row.action,
			args: row.args,
		}));
		const events = this.getRecentEvents(eventLimit).map((row) => ({
			kind: "event" as const,
			ts: row.ts,
			type: row.type,
			payload: row.payload,
		}));
		const combined = [...actions, ...events];
		combined.sort((a, b) => {
			const timeA = tsValue(a.ts);
			const timeB = tsValue(b.ts);
			if (timeA !== timeB) return timeA - timeB;
			if (a.kind === b.kind) return 0;
			return a.kind === "action" ? -1 : 1;
		});
		return combined;
	}
}

function nowIso(): string {
	return new Date().toISOString();
}

function toJson(value: unknown): string | null {
	try {
		return JSON.stringify(value);
	} catch {
		return null;
	}
}

function truncate(text: string | null | undefined): string | null {
	if (!text) return null;
	if (text.length <= MAX_TEXT) return text;
	return text.slice(0, MAX_TEXT);
}

function tsValue(ts: string): number {
	const value = Date.parse(ts);
	return Number.isFinite(value) ? value : 0;
}
