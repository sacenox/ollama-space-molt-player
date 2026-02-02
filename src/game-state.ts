import type { ClientState } from "../client/src/client";
import type { WorldSnapshot } from "./prompt";
import type { TuiContext } from "./tui/index";
import type {
	ActionHistoryEntry,
	Credentials,
	RegistrationChoice,
	RegistrationContext,
} from "./types";

export class GameState {
	credentials: Credentials | null = null;
	pendingRegistration: RegistrationChoice | null = null;
	worldSnapshot: WorldSnapshot = {};

	travelInProgress = false;
	lastTravelTarget: string | null = null;
	jumpInProgress = false;
	lastJumpTarget: string | null = null;

	currentMission: string | null = null;

	// Tracking for changes
	lastSystemId: string | null = null;
	lastPoiId: string | null = null;
	lastDocked = false;
	inCombat = false;
	lastForumThreadId: string | null = null;
	lastForumPostTitle: string | null = null;
	lastForumPostCategory: string | null = null;
	lastForumPostAt: number | null = null;
	lastForumThreadReadAt: number | null = null;

	cachedPlayer: ClientState["player"] = null;
	cachedShip: ClientState["ship"] = null;
	lastCredits: number | null = null;

	registrationRetries = 0;
	registrationContext: RegistrationContext = { failedNames: [] };

	// TUI context (warnings + forum) - updated during action loop
	tuiContext: TuiContext = {};
	pendingActionId: number | null = null;
	pendingActionTimeout: ReturnType<typeof setTimeout> | null = null;

	// Current game activity for status display
	currentActivity: import("./types").GameStatusType = "waiting_for_tick";
	activityDetails: string | null = null;

	// Action history for result panel (max 5 entries)
	actionHistory: ActionHistoryEntry[] = [];

	readonly MAX_REGISTRATION_RETRIES = 3;
	readonly MAX_ACTION_HISTORY = 5;

	pushActionHistory(entry: ActionHistoryEntry): void {
		this.actionHistory.unshift(entry); // Add to front
		if (this.actionHistory.length > this.MAX_ACTION_HISTORY) {
			this.actionHistory.pop(); // Remove oldest
		}
	}
}
