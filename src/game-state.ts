import type { ClientState } from "../client/src/client";
import type { WorldSnapshot } from "./prompt";
import type { TuiContext } from "./tui/index";
import type {
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

	readonly MAX_REGISTRATION_RETRIES = 3;
}
