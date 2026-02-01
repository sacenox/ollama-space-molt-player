// Main TUI orchestrator with multi-panel dashboard

import blessed from "blessed";
import type { Base, Player, POI, Ship, System } from "../../client/src/types";
import type { PersonalityType } from "../actions";
import type { AlignmentType } from "../types";
import { applyColor, COLORS, THRESHOLDS } from "./colors";
import type { FormattedMessage } from "./formatters";
import { computeLayout, createBoxOptions } from "./layout";
import { type LocationData, renderLocationPanel } from "./panels/location";
import { LogPanel, type LogTab } from "./panels/log";
import {
	type PlayerShipData,
	renderPlayerShipPanel,
} from "./panels/player-ship";
import { renderTacticalPanel, type TacticalData } from "./panels/tactical";
import { renderWorldInfoPanel, type WorldInfoData } from "./panels/world-info";

export interface TuiUpdateData {
	player?: Player | null;
	ship?: Ship | null;
	system?: System | null;
	poi?: POI | null;
	base?: Base | null;
	pois?: Array<{ id: string; name: string; type?: string }>;
	nearby?: Array<{ player_id?: string; username?: string }>;
	alignment?: AlignmentType;
	personality?: PersonalityType;
	tick?: number;
	traveling?: boolean;
	travelTarget?: string | null;
	jumping?: boolean;
	jumpTarget?: string | null;
	goal?: string | null;
	inCombat?: boolean;
	combatTarget?: {
		id: string;
		username?: string;
		hull?: number;
		maxHull?: number;
		shield?: number;
		maxShield?: number;
	};
}

export class Tui {
	private screen: blessed.Widgets.Screen;
	private playerShipBox: blessed.Widgets.BoxElement;
	private worldInfoBox: blessed.Widgets.BoxElement;
	private logPanel: LogPanel;
	private locationBox: blessed.Widgets.BoxElement;
	private tacticalBox: blessed.Widgets.BoxElement;
	private statusBar: blessed.Widgets.BoxElement;
	private debugBox: blessed.Widgets.BoxElement | null;
	private exitHandler: (() => void) | null = null;
	private debugEnabled: boolean;

	// Cached state for rendering
	private state: TuiUpdateData = {};

	constructor(debugEnabled = false) {
		this.debugEnabled = debugEnabled;
		this.screen = blessed.screen({
			smartCSR: true,
			title: "SpaceMolt Ollama Player",
			fullUnicode: false,
			terminal: resolveTerminal(),
		});

		const termWidth =
			typeof this.screen.width === "number"
				? this.screen.width
				: this.screen.cols;
		const termHeight =
			typeof this.screen.height === "number"
				? this.screen.height
				: this.screen.rows;

		const layout = computeLayout(termWidth, termHeight);

		// Create panels
		this.playerShipBox = blessed.box(
			createBoxOptions(
				layout.playerShip,
				"Player/Ship",
				COLORS.PANEL_BORDER_INACTIVE,
			),
		);
		this.screen.append(this.playerShipBox);

		this.worldInfoBox = blessed.box(
			createBoxOptions(
				layout.worldInfo,
				"World Info",
				COLORS.PANEL_BORDER_INACTIVE,
			),
		);
		this.screen.append(this.worldInfoBox);

		this.logPanel = new LogPanel(this.screen, layout.log);

		this.locationBox = blessed.box(
			createBoxOptions(
				layout.location,
				"Location",
				COLORS.PANEL_BORDER_INACTIVE,
			),
		);
		this.screen.append(this.locationBox);

		this.tacticalBox = blessed.box(
			createBoxOptions(
				layout.tactical,
				"Tactical",
				COLORS.PANEL_BORDER_INACTIVE,
			),
		);
		this.screen.append(this.tacticalBox);

		this.statusBar = blessed.box({
			parent: this.screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			tags: true,
			style: {
				bg: "black",
				fg: "cyan",
			},
			content: "Starting...",
		});

		// Debug panel (optional) - positioned right of main layout
		this.debugBox = this.debugEnabled
			? blessed.box({
					parent: this.screen,
					top: 0,
					left: termWidth,
					width: 0,
					height: "100%-1",
					tags: false,
					border: "line",
					label: "Debug Prompt",
					style: {
						border: {
							fg: "blue",
						},
						bg: "black",
						fg: "white",
					},
					scrollable: true,
					alwaysScroll: false,
					scrollbar: {
						ch: " ",
						inverse: true,
					},
					content: "No prompt yet",
				})
			: null;

		// Keyboard handlers
		this.screen.key(["q", "C-c"], () => {
			if (this.exitHandler) {
				this.exitHandler();
			} else {
				process.exit(0);
			}
		});

		// Tab switching
		this.screen.key(["1"], () => this.switchTab("all"));
		this.screen.key(["2"], () => this.switchTab("game"));
		this.screen.key(["3"], () => this.switchTab("ai"));
		this.screen.key(["4"], () => this.switchTab("combat"));
		this.screen.key(["5"], () => this.switchTab("chat"));
		this.screen.key(["6"], () => this.switchTab("system"));

		this.screen.on("resize", () => {
			this.applyLayout();
			this.render();
		});

		this.render();
	}

	onExit(handler: () => void): void {
		this.exitHandler = handler;
	}

	log(message: FormattedMessage): void {
		this.logPanel.appendMessage(message);
		this.screen.render();
	}

	update(data: TuiUpdateData): void {
		// Merge new data into state
		// Note: player/ship skip null to preserve data when events don't include them
		// Other fields allow null since they can legitimately be cleared (e.g., undocking clears base)
		if (data.player !== undefined && data.player !== null)
			this.state.player = data.player;
		if (data.ship !== undefined && data.ship !== null)
			this.state.ship = data.ship;
		if (data.system !== undefined) this.state.system = data.system;
		if (data.poi !== undefined) this.state.poi = data.poi;
		if (data.base !== undefined) this.state.base = data.base;
		if (data.pois !== undefined) this.state.pois = data.pois;
		if (data.nearby !== undefined) this.state.nearby = data.nearby;
		if (data.alignment !== undefined) this.state.alignment = data.alignment;
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

		this.updatePanels();
		this.render();
	}

	setStatus(text: string): void {
		this.statusBar.setContent(applyColor(text, COLORS.PANEL_VALUE));
		this.screen.render();
	}

	setPrompt(content: string): void {
		if (!this.debugBox) return;
		this.debugBox.setContent(content);
		this.screen.render();
	}

	destroy(): void {
		this.screen.destroy();
	}

	private switchTab(tab: LogTab): void {
		this.logPanel.setTab(tab);
		this.screen.render();
	}

	private updatePanels(): void {
		// Player/Ship panel
		const playerShipData: PlayerShipData = {
			player: this.state.player ?? null,
			ship: this.state.ship ?? null,
			alignment: this.state.alignment,
			personality: this.state.personality,
			tick: this.state.tick ?? 0,
		};
		this.playerShipBox.setContent(renderPlayerShipPanel(playerShipData));

		// World Info panel
		const worldInfoData: WorldInfoData = {
			base: this.state.base ?? null,
		};
		this.worldInfoBox.setContent(renderWorldInfoPanel(worldInfoData));

		// Location panel
		const locationData: LocationData = {
			player: this.state.player ?? null,
			system: this.state.system ?? null,
			poi: this.state.poi ?? null,
			pois: this.state.pois ?? [],
			traveling: this.state.traveling ?? false,
			travelTarget: this.state.travelTarget ?? null,
			jumping: this.state.jumping ?? false,
			jumpTarget: this.state.jumpTarget ?? null,
		};
		this.locationBox.setContent(renderLocationPanel(locationData));

		// Tactical panel
		const tacticalData: TacticalData = {
			inCombat: this.state.inCombat ?? false,
			combatTarget: this.state.combatTarget,
			nearby: this.state.nearby ?? [],
		};
		this.tacticalBox.setContent(renderTacticalPanel(tacticalData));

		// Status bar
		this.updateStatusBar();
	}

	private updateStatusBar(): void {
		const parts: string[] = [];

		// Current status
		if (this.state.inCombat) {
			parts.push(applyColor("COMBAT", COLORS.STATUS_DANGER));
		} else if (this.state.jumping) {
			const target = this.state.jumpTarget ?? "unknown";
			parts.push(`Jumping to ${target}`);
		} else if (this.state.traveling) {
			const target = this.state.travelTarget ?? "unknown";
			parts.push(`Traveling to ${target}`);
		} else if (this.state.player?.docked_at_base) {
			parts.push("Docked");
		} else if (this.state.poi?.name) {
			parts.push(`At ${this.state.poi.name}`);
		}

		// Goal
		if (this.state.goal) {
			parts.push(`Goal: ${this.state.goal}`);
		}

		// Tick
		if (this.state.tick !== undefined) {
			parts.push(`Tick: ${this.state.tick}`);
		}

		// Fuel warning
		if (this.state.ship) {
			const fuelPct = (this.state.ship.fuel / this.state.ship.max_fuel) * 100;
			if (fuelPct < THRESHOLDS.FUEL_LOW) {
				parts.push(
					applyColor(
						`LOW FUEL (${Math.round(fuelPct)}%)`,
						COLORS.STATUS_DANGER,
					),
				);
			}
		}

		// Controls hint
		parts.push("Press 'q' to quit");

		this.statusBar.setContent(parts.join(" | "));
	}

	private applyLayout(): void {
		const termWidth =
			typeof this.screen.width === "number"
				? this.screen.width
				: this.screen.cols;
		const termHeight =
			typeof this.screen.height === "number"
				? this.screen.height
				: this.screen.rows;

		const layout = computeLayout(termWidth, termHeight);

		// Update panel dimensions
		this.playerShipBox.left = layout.playerShip.left;
		this.playerShipBox.top = layout.playerShip.top;
		this.playerShipBox.width = layout.playerShip.width;
		this.playerShipBox.height = layout.playerShip.height;

		this.worldInfoBox.left = layout.worldInfo.left;
		this.worldInfoBox.top = layout.worldInfo.top;
		this.worldInfoBox.width = layout.worldInfo.width;
		this.worldInfoBox.height = layout.worldInfo.height;

		this.logPanel.updateDimensions(layout.log);

		this.locationBox.left = layout.location.left;
		this.locationBox.top = layout.location.top;
		this.locationBox.width = layout.location.width;
		this.locationBox.height = layout.location.height;

		this.tacticalBox.left = layout.tactical.left;
		this.tacticalBox.top = layout.tactical.top;
		this.tacticalBox.width = layout.tactical.width;
		this.tacticalBox.height = layout.tactical.height;

		this.statusBar.top = layout.statusBar.top;
		this.statusBar.width = layout.statusBar.width;

		// Debug panel - positioned off-screen by default, can be toggled
		if (this.debugBox) {
			const debugWidth = Math.floor(termWidth * 0.3);
			this.debugBox.left = termWidth - debugWidth;
			this.debugBox.width = debugWidth;
		}
	}

	private render(): void {
		this.screen.render();
	}
}

function resolveTerminal(): string | undefined {
	const override = process.env.BLESSED_TERM;
	if (override) return override;
	const term = process.env.TERM;
	if (term === "xterm-ghostty") return "xterm-256color";
	return term ?? "xterm-256color";
}
