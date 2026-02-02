import { Database } from "bun:sqlite";
import type {
	AlignmentType,
	Credentials,
	PersonalityType,
	SpeechStyleType,
} from "./types";

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
	tick: number;
	action: string;
	args: string | null;
	prompt_excerpt: string | null;
	model_raw: string | null;
	thinking: string | null;
}

export interface StoredEvent {
	id: number;
	ts: string;
	tick: number;
	type: string;
	payload: string | null;
}

export interface ActionResult {
	ts: string;
	tick: number;
	result_type: string;
	payload: string | null;
}

export type HistoryEntry =
	| {
			kind: "action";
			ts: string;
			tick: number;
			action: string;
			args: string | null;
	  }
	| {
			kind: "event";
			ts: string;
			tick: number;
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
		// Run migrations BEFORE creating tables to handle renames
		this.migratePreCreate();

		this.db.exec(`
      CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        action TEXT NOT NULL,
        args TEXT,
        prompt_excerpt TEXT,
        model_raw TEXT,
        thinking TEXT
      );
      CREATE TABLE IF NOT EXISTS action_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_id INTEGER NOT NULL,
        ts TEXT NOT NULL,
        result_type TEXT NOT NULL,
        payload TEXT,
        FOREIGN KEY (action_id) REFERENCES actions(id)
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT
      );
      CREATE TABLE IF NOT EXISTS llm_missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        username TEXT NOT NULL,
        mission TEXT NOT NULL
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
      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        username TEXT NOT NULL,
        token TEXT NOT NULL,
        personality TEXT NOT NULL,
        alignment TEXT NOT NULL DEFAULT 'neutral',
        speech_style TEXT NOT NULL DEFAULT 'mythic'
      );
    `);

		// Run column additions AFTER tables are created
		this.migratePostCreate();
	}

	private migratePreCreate(): void {
		// Check which tables exist
		const tables = this.db
			.query("SELECT name FROM sqlite_master WHERE type='table'")
			.all() as { name: string }[];
		const tableNames = tables.map((t) => t.name);

		// Migrate llm_goals to llm_missions
		const hasGoalsTable = tableNames.includes("llm_goals");
		const hasMissionsTable = tableNames.includes("llm_missions");

		if (hasGoalsTable && !hasMissionsTable) {
			// Rename table from llm_goals to llm_missions
			this.db.exec("ALTER TABLE llm_goals RENAME TO llm_missions");
		}

		// If llm_missions exists, check if it needs the column renamed
		if (hasMissionsTable || hasGoalsTable) {
			const missionColumns = this.db
				.query("PRAGMA table_info(llm_missions)")
				.all() as { name: string }[];
			const hasGoalColumn = missionColumns.some((col) => col.name === "goal");
			if (hasGoalColumn) {
				this.db.exec("ALTER TABLE llm_missions RENAME COLUMN goal TO mission");
			}
		}
	}

	private migratePostCreate(): void {
		// Add alignment + speech_style columns if they don't exist (for existing DBs)
		const credColumns = this.db
			.query("PRAGMA table_info(credentials)")
			.all() as {
			name: string;
		}[];
		const hasAlignment = credColumns.some((col) => col.name === "alignment");
		const hasSpeechStyle = credColumns.some(
			(col) => col.name === "speech_style",
		);
		if (!hasAlignment) {
			this.db.exec(
				"ALTER TABLE credentials ADD COLUMN alignment TEXT NOT NULL DEFAULT 'neutral'",
			);
		}
		if (!hasSpeechStyle) {
			this.db.exec(
				"ALTER TABLE credentials ADD COLUMN speech_style TEXT NOT NULL DEFAULT 'mythic'",
			);
		}

		// Add tick columns to actions, action_results, and events tables
		const actionColumns = this.db.query("PRAGMA table_info(actions)").all() as {
			name: string;
		}[];
		const actionsHasTick = actionColumns.some((col) => col.name === "tick");
		if (!actionsHasTick) {
			this.db.exec(
				"ALTER TABLE actions ADD COLUMN tick INTEGER NOT NULL DEFAULT 0",
			);
		}

		const actionResultColumns = this.db
			.query("PRAGMA table_info(action_results)")
			.all() as { name: string }[];
		const actionResultsHasTick = actionResultColumns.some(
			(col) => col.name === "tick",
		);
		if (!actionResultsHasTick) {
			this.db.exec(
				"ALTER TABLE action_results ADD COLUMN tick INTEGER NOT NULL DEFAULT 0",
			);
		}

		const eventColumns = this.db.query("PRAGMA table_info(events)").all() as {
			name: string;
		}[];
		const eventsHasTick = eventColumns.some((col) => col.name === "tick");
		if (!eventsHasTick) {
			this.db.exec(
				"ALTER TABLE events ADD COLUMN tick INTEGER NOT NULL DEFAULT 0",
			);
		}
	}

	getCredentials(): Credentials | null {
		const row = this.db
			.query(
				"SELECT username, token, personality, alignment, speech_style FROM credentials ORDER BY id DESC LIMIT 1",
			)
			.get() as
			| {
					username?: string;
					token?: string;
					personality?: string;
					alignment?: string;
					speech_style?: string;
			  }
			| undefined;
		if (!row || !row.username || !row.token || !row.personality) return null;
		return {
			username: row.username,
			token: row.token,
			personality: row.personality as PersonalityType,
			alignment: (row.alignment as AlignmentType) ?? "neutral",
			speech_style: (row.speech_style as SpeechStyleType) ?? "mythic",
		};
	}

	saveCredentials(
		username: string,
		token: string,
		personality: PersonalityType,
		alignment: AlignmentType,
		speechStyle: SpeechStyleType,
	): void {
		this.db
			.query(
				"INSERT INTO credentials (ts, username, token, personality, alignment, speech_style) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.run(nowIso(), username, token, personality, alignment, speechStyle);
	}

	appendAction(
		tick: number,
		action: string,
		args: unknown,
		promptExcerpt: string,
		modelRaw: string,
		thinking: string | null,
	): void {
		this.db
			.query(
				"INSERT INTO actions (ts, tick, action, args, prompt_excerpt, model_raw, thinking) VALUES (?, ?, ?, ?, ?, ?, ?)",
			)
			.run(
				nowIso(),
				tick,
				action,
				toJson(args),
				truncate(promptExcerpt),
				truncate(modelRaw),
				thinking,
			);
	}

	appendActionWithId(
		tick: number,
		action: string,
		args: unknown,
		promptExcerpt: string,
		modelRaw: string,
		thinking: string | null,
	): number {
		const result = this.db
			.query(
				"INSERT INTO actions (ts, tick, action, args, prompt_excerpt, model_raw, thinking) VALUES (?, ?, ?, ?, ?, ?, ?)",
			)
			.run(
				nowIso(),
				tick,
				action,
				toJson(args),
				truncate(promptExcerpt),
				truncate(modelRaw),
				thinking,
			);
		return Number(result.lastInsertRowid);
	}

	appendActionResult(
		actionId: number,
		tick: number,
		resultType: string,
		payload: unknown,
	): void {
		this.db
			.query(
				"INSERT INTO action_results (action_id, ts, tick, result_type, payload) VALUES (?, ?, ?, ?, ?)",
			)
			.run(actionId, nowIso(), tick, resultType, toJson(payload));
	}

	appendEvent(tick: number, type: string, payload: unknown): void {
		this.db
			.query("INSERT INTO events (ts, tick, type, payload) VALUES (?, ?, ?, ?)")
			.run(nowIso(), tick, type, toJson(payload));
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

	setMission(username: string, mission: string): void {
		this.db
			.query(
				"INSERT INTO llm_missions (ts, username, mission) VALUES (?, ?, ?)",
			)
			.run(nowIso(), username, mission);
	}

	getLatestMission(username: string): string | null {
		const row = this.db
			.query(
				"SELECT mission FROM llm_missions WHERE username = ? ORDER BY id DESC LIMIT 1",
			)
			.get(username) as { mission?: string } | undefined;
		if (!row || !row.mission) return null;
		return row.mission;
	}

	getRecentActions(limit: number): StoredAction[] {
		const rows = this.db
			.query(
				"SELECT id, ts, tick, action, args, prompt_excerpt, model_raw FROM actions ORDER BY id DESC LIMIT ?",
			)
			.all(limit) as StoredAction[];
		return rows.reverse();
	}

	getRecentEvents(limit: number): StoredEvent[] {
		const rows = this.db
			.query(
				"SELECT id, ts, tick, type, payload FROM events ORDER BY id DESC LIMIT ?",
			)
			.all(limit) as StoredEvent[];
		return rows.reverse();
	}

	getRecentHistory(actionLimit: number, eventLimit: number): HistoryEntry[] {
		const actions = this.getRecentActions(actionLimit).map((row) => ({
			kind: "action" as const,
			ts: row.ts,
			tick: row.tick,
			action: row.action,
			args: row.args,
		}));
		const events = this.getRecentEvents(eventLimit).map((row) => ({
			kind: "event" as const,
			ts: row.ts,
			tick: row.tick,
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

	getResultsForAction(tick: number, action: string): ActionResult[] {
		const actionRow = this.db
			.query(
				"SELECT id FROM actions WHERE tick = ? AND action = ? ORDER BY id DESC LIMIT 1",
			)
			.get(tick, action) as { id: number } | undefined;
		if (!actionRow) return [];
		const results = this.db
			.query(
				"SELECT ts, tick, result_type, payload FROM action_results WHERE action_id = ? ORDER BY id ASC",
			)
			.all(actionRow.id) as ActionResult[];
		return results;
	}

	getLastActionWithResults(): {
		action: StoredAction;
		results: ActionResult[];
	} | null {
		const action = this.db
			.query(
				"SELECT id, ts, tick, action, args, prompt_excerpt, model_raw FROM actions ORDER BY id DESC LIMIT 1",
			)
			.get() as StoredAction | undefined;
		if (!action) return null;
		const results = this.db
			.query(
				"SELECT ts, tick, result_type, payload FROM action_results WHERE action_id = ? ORDER BY id ASC",
			)
			.all(action.id) as ActionResult[];
		return { action, results };
	}

	getLatestTick(): number {
		const row = this.db
			.query("SELECT tick FROM state_snapshots ORDER BY id DESC LIMIT 1")
			.get() as { tick?: number } | undefined;
		return row?.tick ?? 0;
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
