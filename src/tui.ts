import blessed from "blessed";

export class Tui {
  private screen: blessed.Widgets.Screen;
  private logBox: blessed.Widgets.Log;
  private statusBar: blessed.Widgets.BoxElement;
  private exitHandler: (() => void) | null = null;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "SpaceMolt Ollama Player",
      fullUnicode: false,
      terminal: resolveTerminal(),
    });

    this.logBox = blessed.log({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
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

  destroy(): void {
    this.screen.destroy();
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
  if (lower.startsWith("error") || lower.includes("error") || lower.includes("failed")) {
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
