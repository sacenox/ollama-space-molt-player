import blessed from "blessed";

export class Tui {
	private screen: blessed.Widgets.Screen;
	private logBox: blessed.Widgets.Log;
	private sidebar: blessed.Widgets.BoxElement;
	private promptSidebar: blessed.Widgets.BoxElement | null;
	private statusBar: blessed.Widgets.BoxElement;
	private exitHandler: (() => void) | null = null;
	private sidebarWidth = 30;
	private debugEnabled: boolean;

	constructor(debugEnabled = false) {
		this.debugEnabled = debugEnabled;
		this.screen = blessed.screen({
			smartCSR: true,
			title: "SpaceMolt Ollama Player",
			fullUnicode: false,
			terminal: resolveTerminal(),
		});

		this.sidebar = blessed.box({
			parent: this.screen,
			top: 0,
			left: 0,
			width: this.sidebarWidth,
			height: "100%-1",
			tags: true,
			border: "line",
			label: "Snapshot",
			style: {
				border: {
					fg: "blue",
				},
				bg: "black",
				fg: "white",
			},
			content: "No data",
		});

		this.logBox = blessed.log({
			parent: this.screen,
			top: 0,
			left: this.sidebarWidth,
			width: `100%-${this.sidebarWidth}`,
			height: "100%-1",
			tags: true,
			border: "line",
			label: "Log",
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

		this.promptSidebar = this.debugEnabled
			? blessed.box({
					parent: this.screen,
					top: 0,
					left: 0,
					width: 1,
					height: "100%-1",
					tags: false,
					border: "line",
					label: "Prompt",
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

		this.screen.key(["q", "C-c"], () => {
			if (this.exitHandler) {
				this.exitHandler();
			} else {
				process.exit(0);
			}
		});

		this.applyLayout();

		this.screen.on("resize", () => {
			this.applyLayout();
			this.screen.render();
		});

		this.screen.render();
	}

	onExit(handler: () => void): void {
		this.exitHandler = handler;
	}

	log(message: string): void {
		this.logBox.log(colorize(message));
		this.screen.render();
	}

	setStatus(text: string): void {
		this.statusBar.setContent(`{cyan-fg}${text}{/cyan-fg}`);
		this.screen.render();
	}

	setSidebar(content: string): void {
		this.sidebar.setContent(content);
		this.screen.render();
	}

	setPrompt(content: string): void {
		if (!this.promptSidebar) return;
		this.promptSidebar.setContent(content);
		this.screen.render();
	}

	destroy(): void {
		this.screen.destroy();
	}

	private applyLayout(): void {
		const totalWidth =
			typeof this.screen.width === "number"
				? this.screen.width
				: this.screen.cols;
		const sidebarWidth = Math.min(
			this.sidebarWidth,
			Math.max(totalWidth - 10, 1),
		);
		const availableWidth = Math.max(totalWidth - sidebarWidth, 1);

		this.sidebar.left = 0;
		this.sidebar.width = sidebarWidth;

		if (this.promptSidebar) {
			const promptWidth = Math.max(Math.floor(availableWidth / 2), 1);
			const logWidth = Math.max(availableWidth - promptWidth, 1);

			this.logBox.left = sidebarWidth;
			this.logBox.width = logWidth;

			this.promptSidebar.left = sidebarWidth + logWidth;
			this.promptSidebar.width = promptWidth;
		} else {
			this.logBox.left = sidebarWidth;
			this.logBox.width = availableWidth;
		}
	}
}

function resolveTerminal(): string | undefined {
	const override = process.env.BLESSED_TERM;
	if (override) return override;
	const term = process.env.TERM;
	if (term === "xterm-ghostty") return "xterm-256color";
	return term ?? "xterm-256color";
}

function colorize(message: string): string {
	const lower = message.toLowerCase();
	if (lower.startsWith("[thinking]")) {
		return `{gray-fg}${message}{/gray-fg}`;
	}
	if (
		lower.startsWith("error") ||
		lower.includes("error") ||
		lower.includes("failed")
	) {
		return `{red-fg}${message}{/red-fg}`;
	}
	if (lower.includes("in combat")) {
		return `{red-fg}${message}{/red-fg}`;
	}
	if (lower.startsWith("action:")) {
		return `{cyan-fg}${message}{/cyan-fg}`;
	}
	if (lower.startsWith("welcome") || lower.startsWith("logged in")) {
		return `{green-fg}${message}{/green-fg}`;
	}
	if (lower.startsWith("motd")) {
		return `{yellow-fg}${message}{/yellow-fg}`;
	}
	return message;
}
