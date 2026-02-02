// Main TUI orchestrator with multi-panel dashboard

import blessed from "blessed";
import type { Base, Player, POI, Ship, System } from "../../client/src/types";
import type {
	ActionHistoryEntry,
	AlignmentType,
	GameStatusType,
} from "../types";
import type { FormattedMessage } from "./formatters";
import { computeLayout, createBoxOptions } from "./layout";
import { renderActionResultPanel } from "./panels/action-result";
import { renderContextPanel } from "./panels/context";
import { renderGameStatusPanel } from "./panels/game-status";
// Panels
import { LogPanel, type LogTab } from "./panels/log";
import {
	type NavigationData,
	renderNavigationPanel,
} from "./panels/navigation";
import { type PlayerData, renderPlayerPanel } from "./panels/player";
import { renderShipPanel, type ShipData } from "./panels/ship";
import { renderTacticalPanel, type TacticalData } from "./panels/tactical";
import { PALETTE, THEME } from "./theme";
import { applyColor } from "./widgets";

export interface ContextWarnings {
	repetition?: {
		action: string;
		count: number;
	} | null;
	stranded?: boolean;
}

export interface ContextForum {
	followUpStatus?: "unread" | "periodic" | null;
	lastThreadId?: string | null;
	lastPostTitle?: string | null;
	lastPostCategory?: string | null;
}

export interface TuiContext {
	warnings?: ContextWarnings;
	forum?: ContextForum;
	memorySummary?: string | null;
	lastActionResult?: string | null;
	thinking?: string | null;
}

export interface TuiUpdateData {
	player?: Player | null;
	ship?: Ship | null;
	system?: System | null;
	poi?: POI | null;
	base?: Base | null;
	pois?: Array<{ id: string; name: string; type?: string }>;
	nearby?: Array<{
		player_id?: string;
		username?: string;
		ship_class?: string;
		faction_tag?: string;
	}>;
	alignment?: AlignmentType;
	personality_title?: string;
	personality_behavior?: string;
	tick?: number;
	traveling?: boolean;
	travelTarget?: string | null;
	jumping?: boolean;
	jumpTarget?: string | null;
	mission?: string | null;
	inCombat?: boolean;
	combatTarget?: {
		id: string;
		username?: string;
		hull?: number;
		maxHull?: number;
		shield?: number;
		maxShield?: number;
	};
	context?: TuiContext;
	actionHistory?: ActionHistoryEntry[];
}

export class Tui {
	private screen: blessed.Widgets.Screen;

	// Panel Boxes
	private playerBox: blessed.Widgets.BoxElement;
	private shipBox: blessed.Widgets.BoxElement;
	private navigationBox: blessed.Widgets.BoxElement;

	private logPanel: LogPanel;
	private actionResultBox: blessed.Widgets.BoxElement;
	private gameStatusBox: blessed.Widgets.BoxElement;

	private tacticalBox: blessed.Widgets.BoxElement;
	private contextBox: blessed.Widgets.BoxElement;

	private statusBar: blessed.Widgets.BoxElement;
	private debugBox: blessed.Widgets.BoxElement | null;

	private exitHandler: (() => void) | null = null;
	private debugEnabled: boolean;

	// Spinner animation
	private spinnerFrame = 0;
	private spinnerInterval: NodeJS.Timeout | null = null;

	// Cached state for rendering
	private state: TuiUpdateData = {};

	constructor(debugEnabled = false) {
		this.debugEnabled = debugEnabled;
		this.screen = blessed.screen({
			smartCSR: true,
			title: "SpaceMolt Ollama Player",
			fullUnicode: true, // Enabled for symbols
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

		// -- LEFT COLUMN --
		this.playerBox = blessed.box(
			createBoxOptions(layout.player, " PLAYER ", THEME.BORDER_INACTIVE),
		);
		this.screen.append(this.playerBox);

		this.shipBox = blessed.box(
			createBoxOptions(layout.ship, " SHIP ", THEME.BORDER_INACTIVE),
		);
		this.screen.append(this.shipBox);

		this.navigationBox = blessed.box(
			createBoxOptions(layout.navigation, " NAV ", THEME.BORDER_INACTIVE),
		);
		this.screen.append(this.navigationBox);

		// -- CENTER COLUMN --
		this.logPanel = new LogPanel(this.screen, layout.log);

		this.actionResultBox = blessed.box(
			createBoxOptions(layout.actionResult, " ACTIONS ", PALETTE.AMBER),
		);
		this.screen.append(this.actionResultBox);

		this.gameStatusBox = blessed.box(
			createBoxOptions(layout.gameStatus, " ACTIVITY ", PALETTE.MOSS),
		);
		this.screen.append(this.gameStatusBox);

		// -- RIGHT COLUMN --
		this.tacticalBox = blessed.box(
			createBoxOptions(layout.tactical, " TACTICAL ", THEME.BORDER_INACTIVE),
		);
		this.screen.append(this.tacticalBox);

		this.contextBox = blessed.box(
			createBoxOptions(layout.context, " CONTEXT ", THEME.BORDER_INACTIVE),
		);
		this.screen.append(this.contextBox);

		// -- STATUS BAR --
		this.statusBar = blessed.box({
			parent: this.screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			tags: true,
			style: {
				bg: PALETTE.BLACK,
				fg: PALETTE.WHITE,
			},
			content: "Initializing...",
		});

		// Debug panel (optional)
		this.debugBox = this.debugEnabled
			? blessed.box({
					parent: this.screen,
					top: 0,
					left: termWidth,
					width: 0,
					height: "100%-1",
					tags: false,
					border: "line",
					label: "Debug",
					style: {
						border: { fg: "blue" },
						bg: "black",
						fg: "white",
					},
					scrollable: true,
					alwaysScroll: false,
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

		// Start spinner animation (updates every 100ms)
		this.spinnerInterval = setInterval(() => {
			this.spinnerFrame = (this.spinnerFrame + 1) % 10;
			this.updateGameStatusPanel();
			this.screen.render();
		}, 100);

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
		if (data.personality_title !== undefined)
			this.state.personality_title = data.personality_title;
		if (data.personality_behavior !== undefined)
			this.state.personality_behavior = data.personality_behavior;
		if (data.tick !== undefined) this.state.tick = data.tick;
		if (data.traveling !== undefined) this.state.traveling = data.traveling;
		if (data.travelTarget !== undefined)
			this.state.travelTarget = data.travelTarget;
		if (data.jumping !== undefined) this.state.jumping = data.jumping;
		if (data.jumpTarget !== undefined) this.state.jumpTarget = data.jumpTarget;
		if (data.mission !== undefined) this.state.mission = data.mission;
		if (data.inCombat !== undefined) this.state.inCombat = data.inCombat;
		if (data.combatTarget !== undefined)
			this.state.combatTarget = data.combatTarget;
		if (data.context !== undefined) this.state.context = data.context;
		if (data.actionHistory !== undefined)
			this.state.actionHistory = data.actionHistory;

		this.updatePanels();
		this.render();
	}

	setStatus(text: string): void {
		this.statusBar.setContent(applyColor(text, THEME.VALUE));
		this.screen.render();
	}

	setPrompt(content: string): void {
		if (!this.debugBox) return;
		this.debugBox.setContent(content);
		this.screen.render();
	}

	setGameStatus(activity: GameStatusType, details?: string): void {
		// Update state for game status
		if (!this.state.context) {
			this.state.context = {};
		}
		// Store activity in a temporary field for rendering
		(this.state as { currentActivity?: GameStatusType }).currentActivity =
			activity;
		(this.state as { activityDetails?: string | null }).activityDetails =
			details ?? null;

		this.updateGameStatusPanel();
		this.screen.render();
	}

	private updateGameStatusPanel(): void {
		const activity =
			(this.state as { currentActivity?: GameStatusType }).currentActivity ||
			"waiting_for_tick";
		const details =
			(this.state as { activityDetails?: string | null }).activityDetails ||
			null;

		// Get panel width for centering ASCII art
		const panelWidth =
			typeof this.gameStatusBox.width === "number"
				? this.gameStatusBox.width
				: 30; // Fallback

		this.gameStatusBox.setContent(
			renderGameStatusPanel(
				{
					activity,
					details,
					spinnerFrame: this.spinnerFrame,
				},
				panelWidth,
			),
		);
	}

	destroy(): void {
		if (this.spinnerInterval) {
			clearInterval(this.spinnerInterval);
			this.spinnerInterval = null;
		}
		this.screen.destroy();
	}

	private switchTab(tab: LogTab): void {
		this.logPanel.setTab(tab);
		this.screen.render();
	}

	private updatePanels(): void {
		// Player Panel
		const playerData: PlayerData = {
			player: this.state.player ?? null,
			alignment: this.state.alignment,
			personality_title: this.state.personality_title,
			personality_behavior: this.state.personality_behavior,
			tick: this.state.tick ?? 0,
			currentMission: this.state.mission ?? null,
		};
		this.playerBox.setContent(renderPlayerPanel(playerData));

		// Ship Panel
		const shipData: ShipData = {
			ship: this.state.ship ?? null,
		};
		this.shipBox.setContent(renderShipPanel(shipData));

		// Navigation Panel
		const navData: NavigationData = {
			player: this.state.player ?? null,
			system: this.state.system ?? null,
			poi: this.state.poi ?? null,
			base: this.state.base ?? null,
			pois: this.state.pois ?? [],
			traveling: this.state.traveling ?? false,
			travelTarget: this.state.travelTarget ?? null,
			jumping: this.state.jumping ?? false,
			jumpTarget: this.state.jumpTarget ?? null,
		};
		this.navigationBox.setContent(renderNavigationPanel(navData));

		// Action Result - pass history and panel width
		const history = this.state.actionHistory ?? [];
		const panelWidth =
			typeof this.actionResultBox.width === "number"
				? this.actionResultBox.width
				: 50; // Fallback
		this.actionResultBox.setContent(
			renderActionResultPanel(history, panelWidth),
		);

		// Game Status
		this.updateGameStatusPanel();

		// Tactical Panel
		const tacticalData: TacticalData = {
			inCombat: this.state.inCombat ?? false,
			combatTarget: this.state.combatTarget,
			nearby: this.state.nearby ?? [],
		};
		this.tacticalBox.setContent(renderTacticalPanel(tacticalData));

		// Update Border Color based on threat
		if (this.state.inCombat) {
			this.tacticalBox.style.border.fg = PALETTE.BRICK;
		} else {
			this.tacticalBox.style.border.fg = THEME.BORDER_INACTIVE;
		}

		// Context Panel
		this.contextBox.setContent(renderContextPanel(this.state.context));

		// Status Bar
		this.updateStatusBar();
	}

	private updateStatusBar(): void {
		const parts: string[] = [];
		const tick = this.state.tick ?? 0;

		parts.push(applyColor(`Tick: ${tick}`, PALETTE.GRAY));

		if (this.state.inCombat) {
			parts.push(applyColor("!!! COMBAT !!!", PALETTE.BRICK));
		}

		// Hints
		parts.push(applyColor("Tabs: 1-6 | Exit: q", THEME.INACTIVE));

		this.statusBar.setContent(parts.join("  |  "));
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

		// Left
		this.updateBoxDims(this.playerBox, layout.player);
		this.updateBoxDims(this.shipBox, layout.ship);
		this.updateBoxDims(this.navigationBox, layout.navigation);

		// Center
		this.logPanel.updateDimensions(layout.log);
		this.updateBoxDims(this.actionResultBox, layout.actionResult);
		this.updateBoxDims(this.gameStatusBox, layout.gameStatus);

		// Right
		this.updateBoxDims(this.tacticalBox, layout.tactical);
		this.updateBoxDims(this.contextBox, layout.context);

		// Bottom
		this.statusBar.top = layout.statusBar.top;
		this.statusBar.width = layout.statusBar.width;

		// Debug panel - offscreen by default
		if (this.debugBox) {
			const debugWidth = Math.floor(termWidth * 0.3);
			this.debugBox.left = termWidth - debugWidth;
			this.debugBox.width = debugWidth;
		}
	}

	private updateBoxDims(
		box: blessed.Widgets.BoxElement,
		dims: {
			left: number;
			top: number;
			width: number | string;
			height: number | string;
		},
	) {
		box.left = dims.left;
		box.top = dims.top;
		box.width = dims.width;
		box.height = dims.height;
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
