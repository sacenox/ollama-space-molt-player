// Log panel with tabbed category filtering

import blessed from "blessed";
import { applyBold, applyColor, COLORS } from "../colors";
import type { LogCategory } from "../formatters";

export type LogTab = "all" | LogCategory;

export interface LogMessage {
	text: string;
	category: LogCategory;
}

export class LogPanel {
	private box: blessed.Widgets.Log;
	private activeTab: LogTab = "all";
	private allMessages: LogMessage[] = [];
	private maxMessages = 1000;
	private tabBar: blessed.Widgets.BoxElement;

	constructor(
		parent: blessed.Widgets.Screen,
		dims: {
			left: number;
			top: number;
			width: number | string;
			height: number | string;
		},
	) {
		// Tab bar at top
		this.tabBar = blessed.box({
			parent,
			left: dims.left,
			top: dims.top,
			width: dims.width,
			height: 1,
			tags: true,
			style: {
				bg: "black",
				fg: "white",
			},
		});

		// Log box below tab bar
		this.box = blessed.log({
			parent,
			left: dims.left,
			top: typeof dims.top === "number" ? dims.top + 1 : dims.top,
			width: dims.width,
			height: typeof dims.height === "number" ? dims.height - 1 : dims.height,
			tags: true,
			border: "line",
			label: "Events",
			style: {
				border: {
					fg: "blue",
				},
				bg: "black",
				fg: "white",
			},
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: " ",
				inverse: true,
			},
		});

		this.updateTabBar();
	}

	appendMessage(message: LogMessage): void {
		this.allMessages.push(message);
		if (this.allMessages.length > this.maxMessages) {
			this.allMessages.shift();
		}

		// If message matches active filter, display it
		if (this.activeTab === "all" || this.activeTab === message.category) {
			this.box.log(message.text);
		}
	}

	setTab(tab: LogTab): void {
		if (tab === this.activeTab) return;
		this.activeTab = tab;
		this.updateTabBar();
		this.refreshLog();
	}

	getActiveTab(): LogTab {
		return this.activeTab;
	}

	getBox(): blessed.Widgets.Log {
		return this.box;
	}

	getTabBar(): blessed.Widgets.BoxElement {
		return this.tabBar;
	}

	updateDimensions(dims: {
		left: number;
		top: number;
		width: number | string;
		height: number | string;
	}): void {
		this.tabBar.left = dims.left;
		this.tabBar.top = dims.top;
		this.tabBar.width = dims.width;

		this.box.left = dims.left;
		this.box.top = typeof dims.top === "number" ? dims.top + 1 : dims.top;
		this.box.width = dims.width;
		this.box.height =
			typeof dims.height === "number" ? dims.height - 1 : dims.height;
	}

	private updateTabBar(): void {
		const tabs: Array<{ key: string; label: string; tab: LogTab }> = [
			{ key: "1", label: "All", tab: "all" },
			{ key: "2", label: "Game", tab: "game" },
			{ key: "3", label: "AI", tab: "ai" },
			{ key: "4", label: "Combat", tab: "combat" },
			{ key: "5", label: "Chat", tab: "chat" },
			{ key: "6", label: "System", tab: "system" },
		];

		const parts = tabs.map(({ key, label, tab }) => {
			const isActive = tab === this.activeTab;
			const text = `${key}:${label}`;
			if (isActive) {
				return applyColor(applyBold(text), COLORS.PANEL_TITLE);
			}
			return applyColor(text, COLORS.STATUS_INACTIVE);
		});

		this.tabBar.setContent(` ${parts.join("  ")} `);
	}

	private refreshLog(): void {
		// Clear and re-populate log based on active filter
		this.box.setContent("");
		const filtered =
			this.activeTab === "all"
				? this.allMessages
				: this.allMessages.filter((m) => m.category === this.activeTab);

		for (const msg of filtered) {
			this.box.log(msg.text);
		}
	}
}
