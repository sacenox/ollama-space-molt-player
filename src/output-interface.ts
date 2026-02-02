import type { FormattedMessage } from "./tui/formatters";
import type { TuiUpdateData } from "./tui/index";
import type { GameStatusType } from "./types";

export interface OutputInterface {
	log(message: FormattedMessage): void;
	update(data: TuiUpdateData): void;
	setStatus(text: string): void;
	setPrompt(content: string): void;
	setGameStatus(activity: GameStatusType, details?: string): void;
	logDebug(label: string, content: string): void;
	destroy(): void;
	onExit(handler: () => void): void;
}
