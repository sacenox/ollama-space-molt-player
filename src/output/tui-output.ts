import type { OutputInterface } from "../output-interface";
import type { FormattedMessage } from "../tui/formatters";
import type { TuiUpdateData } from "../tui/index";
import { Tui } from "../tui/index";

export class TuiOutput implements OutputInterface {
	private tui: Tui;

	constructor(debugEnabled: boolean) {
		this.tui = new Tui(debugEnabled);
	}

	log(message: FormattedMessage): void {
		this.tui.log(message);
	}

	update(data: TuiUpdateData): void {
		this.tui.update(data);
	}

	setStatus(text: string): void {
		this.tui.setStatus(text);
	}

	setPrompt(content: string): void {
		this.tui.setPrompt(content);
	}

	logDebug(_label: string, _content: string): void {
		// No-op in interactive mode.
	}

	destroy(): void {
		this.tui.destroy();
	}

	onExit(handler: () => void): void {
		this.tui.onExit(handler);
	}
}
