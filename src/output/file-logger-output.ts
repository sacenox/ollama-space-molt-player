import type { OutputInterface } from "../output-interface";
import type { FormattedMessage } from "../tui/formatters";
import type { TuiUpdateData } from "../tui/index";

type FileLoggerOptions = {
	uiLogPath: string;
	debugLogPath: string;
};

type StateSnapshot = {
	credits: number | null;
	currentSystem: string | null;
	currentPoi: string | null;
	docked: boolean | null;
	inCombat: boolean | null;
	tick: number | null;
};

const HEARTBEAT_INTERVAL = 10;

export class FileLoggerOutput implements OutputInterface {
	private uiLogPath: string;
	private debugLogPath: string;
	private state: TuiUpdateData = {};
	private lastSnapshot: StateSnapshot = {
		credits: null,
		currentSystem: null,
		currentPoi: null,
		docked: null,
		inCombat: null,
		tick: null,
	};
	private lastHeartbeatTick: number | null = null;
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(options: FileLoggerOptions) {
		this.uiLogPath = options.uiLogPath;
		this.debugLogPath = options.debugLogPath;
		this.writeQueue = this.resetLogs();
	}

	log(message: FormattedMessage): void {
		const text = normalizeMessageText(message);
		const line = `[${timestampIso()}] [${message.category.toUpperCase()}] ${text}`;
		this.appendUiLine(line);
	}

	update(data: TuiUpdateData): void {
		this.mergeState(data);
		this.logStateChanges();
	}

	setStatus(_text: string): void {
		// No-op in non-interactive mode.
	}

	setPrompt(content: string): void {
		this.logDebug("PROMPT", content);
	}

	logDebug(label: string, content: string): void {
		const header = `[${timestampIso()}] ${label}`;
		const body = content.endsWith("\n") ? content : `${content}\n`;
		this.appendDebugEntry(`${header}\n${body}\n`);
	}

	destroy(): void {
		// Best-effort flush via queued writes.
	}

	onExit(_handler: () => void): void {
		// Intentionally no-op in non-interactive mode.
		// SIGINT/SIGTERM handlers in index.ts handle graceful shutdown.
	}

	private mergeState(data: TuiUpdateData): void {
		if (data.player !== undefined && data.player !== null)
			this.state.player = data.player;
		if (data.ship !== undefined && data.ship !== null)
			this.state.ship = data.ship;
		if (data.system !== undefined) this.state.system = data.system;
		if (data.poi !== undefined) this.state.poi = data.poi;
		if (data.base !== undefined) this.state.base = data.base;
		if (data.pois !== undefined) this.state.pois = data.pois;
		if (data.nearby !== undefined) this.state.nearby = data.nearby;
		if (data.personality !== undefined)
			this.state.personality = data.personality;
		if (data.tick !== undefined) this.state.tick = data.tick;
		if (data.traveling !== undefined) this.state.traveling = data.traveling;
		if (data.travelTarget !== undefined)
			this.state.travelTarget = data.travelTarget;
		if (data.jumping !== undefined) this.state.jumping = data.jumping;
		if (data.jumpTarget !== undefined) this.state.jumpTarget = data.jumpTarget;
		if (data.goal !== undefined) this.state.goal = data.goal;
		if (data.inCombat !== undefined) this.state.inCombat = data.inCombat;
		if (data.combatTarget !== undefined)
			this.state.combatTarget = data.combatTarget;
	}

	private logStateChanges(): void {
		const player = this.state.player ?? null;
		const tick = this.state.tick ?? null;
		const currentSystem = player?.current_system
			? String(player.current_system)
			: null;
		const currentPoi = player?.current_poi ? String(player.current_poi) : null;
		const docked = player ? Boolean(player.docked_at_base) : null;
		const inCombat = this.state.inCombat ?? null;
		const credits = player?.credits ?? null;

		if (credits !== null && credits !== this.lastSnapshot.credits) {
			if (this.lastSnapshot.credits === null) {
				this.appendUiLine(`[${timestampIso()}] [STATE] Credits: ${credits}`);
			} else {
				const diff = credits - (this.lastSnapshot.credits ?? 0);
				const sign = diff > 0 ? "+" : "";
				this.appendUiLine(
					`[${timestampIso()}] [STATE] Credits: ${credits} (${sign}${diff})`,
				);
			}
			this.lastSnapshot.credits = credits;
		}

		if (inCombat !== null && inCombat !== this.lastSnapshot.inCombat) {
			this.appendUiLine(
				`[${timestampIso()}] [STATE] ${inCombat ? "Combat started" : "Combat ended"}`,
			);
			this.lastSnapshot.inCombat = inCombat;
		}

		if (
			currentSystem &&
			(currentSystem !== this.lastSnapshot.currentSystem ||
				currentPoi !== this.lastSnapshot.currentPoi)
		) {
			const poiPart = currentPoi ? ` | POI: ${currentPoi}` : "";
			this.appendUiLine(
				`[${timestampIso()}] [STATE] Location: ${currentSystem}${poiPart}`,
			);
			this.lastSnapshot.currentSystem = currentSystem;
			this.lastSnapshot.currentPoi = currentPoi;
		}

		if (docked !== null && docked !== this.lastSnapshot.docked) {
			this.appendUiLine(
				`[${timestampIso()}] [STATE] ${docked ? "Docked" : "Undocked"}`,
			);
			this.lastSnapshot.docked = docked;
		}

		if (typeof tick === "number" && tick !== this.lastSnapshot.tick) {
			this.lastSnapshot.tick = tick;
			if (tick % HEARTBEAT_INTERVAL === 0 && this.lastHeartbeatTick !== tick) {
				this.lastHeartbeatTick = tick;
				this.appendUiLine(
					`[${timestampIso()}] [STATE] ${this.buildHeartbeatSummary(tick)}`,
				);
			}
		}
	}

	private buildHeartbeatSummary(tick: number): string {
		const parts: string[] = [`Tick: ${tick}`];
		const player = this.state.player ?? null;
		if (player?.credits !== undefined) {
			parts.push(`Credits: ${player.credits}`);
		}
		if (player?.current_system) {
			parts.push(`System: ${player.current_system}`);
		}
		if (player?.current_poi) {
			parts.push(`POI: ${player.current_poi}`);
		}
		if (player) {
			parts.push(player.docked_at_base ? "Docked" : "In space");
		}
		if (this.state.inCombat) {
			parts.push("Combat");
		}
		return parts.join(" | ");
	}

	private appendUiLine(line: string): void {
		this.enqueueWrite(this.uiLogPath, `${line}\n`);
	}

	private appendDebugEntry(entry: string): void {
		this.enqueueWrite(this.debugLogPath, entry);
	}

	private enqueueWrite(path: string, content: string): void {
		this.writeQueue = this.writeQueue.then(async () => {
			try {
				await Bun.write(path, content, { append: true });
			} catch (error) {
				console.error(
					`Failed to write log ${path}: ${(error as Error).message}`,
				);
			}
		});
	}

	private async resetLogs(): Promise<void> {
		try {
			await Bun.write(this.uiLogPath, "");
			await Bun.write(this.debugLogPath, "");
		} catch (error) {
			console.error(`Failed to initialize logs: ${(error as Error).message}`);
		}
	}
}

function timestampIso(): string {
	return new Date().toISOString();
}

function normalizeMessageText(message: FormattedMessage): string {
	const stripped = stripBlessedTags(message.text);
	return stripped.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "");
}

function stripBlessedTags(text: string): string {
	return text.replace(/\{[^}]+\}/g, "");
}
