import { SpaceMoltClient } from "../client/src/client";
import type {
	ChatMessage,
	ErrorPayload,
	LoggedInPayload,
	RegisteredPayload,
	ScanResultPayload,
	StateUpdatePayload,
	WelcomePayload,
} from "../client/src/types";
import { dispatchAction, validateAction } from "./actions";
import { config } from "./config";
import { GameState } from "./game-state";
import { MemoryStore } from "./memory";
import { OllamaAgent, OllamaTimeoutError } from "./ollama";
import { FileLoggerOutput } from "./output/file-logger-output";
import { TuiOutput } from "./output/tui-output";
import type { OutputInterface } from "./output-interface";
import {
	buildActionPrompt,
	buildLastActionResult,
	buildSummaryPrompt,
	isStranded,
	type WorldSnapshot,
} from "./prompt";
import { runRegistrationFlow } from "./registration";
import {
	formatAiAction,
	formatAiMission,
	formatChatMessage,
	formatError,
	formatLoggedIn,
	formatMiningYield,
	formatMotd,
	formatOk,
	formatScanResult,
	formatSystemMessage,
	formatWelcome,
	type OkContext,
} from "./tui/formatters";
import type {
	AlignmentType,
	Credentials,
	RegistrationOverrides,
	SpeechStyleType,
} from "./types";
import {
	detectRepetition,
	isNearbyTarget,
	sleep,
	truncateThinking,
} from "./utils";

const memory = new MemoryStore(config.memoryPath);
const ollama = new OllamaAgent(
	config.ollamaUrl,
	config.ollamaModel,
	config.ollamaTimeoutMs,
	config.ollamaTemperature,
	config.ollamaThinking,
);
const output: OutputInterface = config.nonInteractive
	? new FileLoggerOutput({
			uiLogPath: config.uiLogPath,
			debugLogPath: config.debugLogPath,
		})
	: new TuiOutput(config.debug);

const client = new SpaceMoltClient({
	url: config.spacemoltUrl,
	debug: false,
	reconnect: true,
});

const gameState = new GameState();
const registrationOverrides: RegistrationOverrides = {
	empire: config.empire ?? undefined,
	alignment: config.alignment ?? undefined,
	speech_style: config.speechStyle ?? undefined,
};
let actionLoopRunning = false;
const REPETITION_THRESHOLD = 3;
let maxTicksStart: number | null = null;
let fallbackTickCount = 0;

async function loadCredentials(): Promise<Credentials | null> {
	try {
		return memory.getCredentials();
	} catch (error) {
		output.log(
			formatSystemMessage(
				`FATAL: Failed to load credentials: ${(error as Error).message}`,
			),
		);
		shutdown();
		return null;
	}
}

async function saveCredentials(
	username: string,
	token: string,
	personalityTitle: string,
	personalityBehavior: string,
	alignment: AlignmentType,
	speechStyle: SpeechStyleType,
): Promise<void> {
	memory.saveCredentials(
		username,
		token,
		personalityTitle,
		personalityBehavior,
		alignment,
		speechStyle,
	);
}

function updateOutput(): void {
	const state = client.state;
	output.update({
		player: gameState.cachedPlayer,
		ship: gameState.cachedShip,
		system: gameState.worldSnapshot.system ?? state.system ?? null,
		poi: gameState.worldSnapshot.poi ?? state.poi ?? null,
		base: gameState.worldSnapshot.base ?? state.base ?? null,
		pois: gameState.worldSnapshot.pois ?? [],
		nearby: state.nearby ?? [],
		alignment: gameState.credentials?.alignment,
		personality_title: gameState.credentials?.personality_title,
		personality_behavior: gameState.credentials?.personality_behavior,
		tick: state.currentTick,
		traveling: gameState.travelInProgress,
		travelTarget: gameState.lastTravelTarget,
		jumping: gameState.jumpInProgress,
		jumpTarget: gameState.lastJumpTarget,
		mission: gameState.currentMission,
		inCombat: gameState.inCombat,
		context: gameState.tuiContext,
	});
}

function captureActionResult(resultType: string, payload: unknown): void {
	if (gameState.pendingActionId === null) return;
	memory.appendActionResult(
		gameState.pendingActionId,
		getCurrentTick(),
		resultType,
		payload,
	);

	// Clear pending action for errors and mining_yield (which comes after ok)
	if (resultType === "error" || resultType === "mining_yield") {
		if (gameState.pendingActionTimeout) {
			clearTimeout(gameState.pendingActionTimeout);
			gameState.pendingActionTimeout = null;
		}
	}
	// For "ok", only clear if it's NOT a mine action (mine waits for mining_yield)
	else if (resultType === "ok") {
		const okPayload = payload as Record<string, unknown>;
		const okAction = String(okPayload?.action ?? "");
		if (okAction !== "mine") {
			if (gameState.pendingActionTimeout) {
				clearTimeout(gameState.pendingActionTimeout);
				gameState.pendingActionTimeout = null;
			}
		}
	}

	output.logDebug(
		"ACTION_RESULT_CAPTURED",
		`${resultType} linked to action ${gameState.pendingActionId}`,
	);
}

function shouldStopForMaxTicks(allowFallbackCount: boolean): boolean {
	if (config.maxTicks === null) return false;
	const currentTick = client.state.currentTick;
	if (typeof currentTick === "number" && maxTicksStart !== null) {
		return currentTick - maxTicksStart >= config.maxTicks;
	}
	if (typeof currentTick === "number" && maxTicksStart === null) {
		maxTicksStart = currentTick;
		return false;
	}
	if (!allowFallbackCount) return false;
	fallbackTickCount += 1;
	return fallbackTickCount >= config.maxTicks;
}

function getCurrentTick(): number {
	const tick = client.state.currentTick;
	if (typeof tick === "number" && Number.isFinite(tick)) return tick;
	return 0;
}

function getForumFollowUpStatus(): "unread" | "periodic" | null {
	const hasPostInfo = Boolean(
		gameState.lastForumThreadId ||
			gameState.lastForumPostTitle ||
			gameState.lastForumPostCategory,
	);
	if (!hasPostInfo) return null;
	const postAt = gameState.lastForumPostAt;
	const readAt = gameState.lastForumThreadReadAt;
	if (postAt !== null && (readAt === null || readAt < postAt)) {
		return "unread";
	}
	return "periodic";
}

function saveSnapshot(): void {
	memory.saveSnapshot({
		tick: client.state.currentTick,
		player: client.state.player,
		ship: client.state.ship,
		system: client.state.system,
		poi: client.state.poi,
		base: client.state.base,
		nearby: client.state.nearby,
	});
}

function refreshSnapshotForLocation(player: {
	current_system?: string;
	current_poi?: string;
	docked_at_base?: string | boolean | null;
}): void {
	const systemId = player.current_system ?? null;
	const poiId = player.current_poi ?? null;
	const docked = Boolean(player.docked_at_base);
	const systemChanged = systemId && systemId !== gameState.lastSystemId;
	const poiChanged = poiId && poiId !== gameState.lastPoiId;

	if (systemChanged) {
		gameState.worldSnapshot.system = null;
		gameState.worldSnapshot.pois = [];
		gameState.worldSnapshot.poi = null;
		gameState.worldSnapshot.base = null;
		client.state.system = null;
		client.state.poi = null;
		client.state.base = null;
		client.getSystem();
		client.getPOI();
		if (docked) {
			client.getBase();
		}
	} else if (poiChanged) {
		gameState.worldSnapshot.poi = null;
		gameState.worldSnapshot.base = null;
		client.state.poi = null;
		client.state.base = null;
		client.getPOI();
		if (docked) {
			client.getBase();
		}
	}

	if (!docked && gameState.lastDocked) {
		gameState.worldSnapshot.base = null;
		client.state.base = null;
	}

	if (docked && !gameState.lastDocked && !systemChanged && !poiChanged) {
		client.getBase();
	}

	if (systemId) gameState.lastSystemId = systemId;
	if (poiId) gameState.lastPoiId = poiId;
	gameState.lastDocked = docked;
}

async function startActionLoop(): Promise<void> {
	if (actionLoopRunning) return;
	actionLoopRunning = true;

	while (client.state.authenticated) {
		const inTransit = gameState.travelInProgress || gameState.jumpInProgress;
		if (shouldStopForMaxTicks(!inTransit)) {
			output.log(
				formatSystemMessage(
					`Max ticks reached (${config.maxTicks}). Shutting down.`,
				),
			);
			shutdown();
			break;
		}
		try {
			if (inTransit) {
				await sleep(config.tickDelayMs);
				continue;
			}
			const recentHistory = memory.getRecentHistory(
				config.maxContextActions,
				config.maxContextEvents,
			);
			const currentTick = getCurrentTick();
			let memorySummary = "(summary unavailable)";
			try {
				const summaryPrompt = buildSummaryPrompt(recentHistory, currentTick);
				const summaryText = await ollama.generateText(summaryPrompt);
				memorySummary = summaryText || "(summary unavailable)";
			} catch (error) {
				const message = (error as Error).message;
				output.logDebug("SUMMARY_ERROR", message);
			}
			const lastActionResult = buildLastActionResult(memory, currentTick);
			const recentActions = memory.getRecentActions(REPETITION_THRESHOLD);
			const repetitionWarning = detectRepetition(
				recentActions,
				REPETITION_THRESHOLD,
			);
			const forumFollowUpStatus = getForumFollowUpStatus();
			const stranded = isStranded(client.state, gameState.worldSnapshot);

			// Update TUI context with warnings and forum data
			gameState.tuiContext = {
				warnings: {
					repetition: repetitionWarning,
					stranded,
				},
				forum: {
					followUpStatus: forumFollowUpStatus,
					lastThreadId: gameState.lastForumThreadId,
					lastPostTitle: gameState.lastForumPostTitle,
					lastPostCategory: gameState.lastForumPostCategory,
				},
				memorySummary,
				lastActionResult,
				thinking: gameState.tuiContext.thinking ?? null, // Preserve existing thinking
			};
			updateOutput();

			const prompt = buildActionPrompt({
				state: client.state,
				worldSnapshot: gameState.worldSnapshot,
				recentHistory,
				memorySummary,
				lastActionResult,
				currentMission: gameState.currentMission,
				currentTick,
				memory,
				empire: client.state.player?.empire,
				alignment: gameState.credentials?.alignment,
				personalityTitle: gameState.credentials?.personality_title,
				personalityBehavior: gameState.credentials?.personality_behavior,
				speechStyle: gameState.credentials?.speech_style,
				lastForumThreadId: gameState.lastForumThreadId,
				lastForumPostTitle: gameState.lastForumPostTitle,
				lastForumPostCategory: gameState.lastForumPostCategory,
				forumFollowUpStatus,
				repetitionWarning,
				lastThinking: gameState.tuiContext.thinking ?? null,
			});

			output.setPrompt(prompt);
			output.logDebug("LLM_PROMPT", prompt);

			const promptExcerpt = prompt.slice(0, 1000);
			const result = await ollama.generateJson(prompt);
			output.logDebug("LLM_RESPONSE_RAW", result.raw);
			if (result.thinking) {
				output.logDebug("LLM_THINKING", result.thinking);
				// Update TUI context with thinking message
				gameState.tuiContext.thinking = result.thinking;
				output.update({ context: gameState.tuiContext });
			}
			const validation = validateAction(result.json);
			if (!validation.ok || !validation.action) {
				const message = `Invalid action from LLM: ${validation.error ?? "unknown"}`;
				output.log(formatSystemMessage(message, getCurrentTick()));
				memory.appendEvent(getCurrentTick(), "llm_invalid_action", {
					error: validation.error,
					raw: result.raw,
				});
				await sleep(config.tickDelayMs);
				continue;
			}

			if (
				(validation.action.action === "scan" ||
					validation.action.action === "attack") &&
				!isNearbyTarget(client.state.nearby, validation.action.args?.target_id)
			) {
				const target = String(validation.action.args?.target_id ?? "").trim();
				const message = target
					? `Invalid action from LLM: Unknown nearby target: ${target}`
					: "Invalid action from LLM: Missing target_id";
				output.log(formatSystemMessage(message, getCurrentTick()));
				memory.appendEvent(getCurrentTick(), "llm_invalid_action", {
					error: message,
					raw: result.raw,
				});
				await sleep(config.tickDelayMs);
				continue;
			}

			const actionName = validation.action.action;
			const mission = validation.action.mission ?? null;
			const actionStamp = getCurrentTick();
			if (actionName === "forum_post") {
				const title = String(validation.action.args?.title ?? "").trim();
				const category = String(validation.action.args?.category ?? "").trim();
				gameState.lastForumPostTitle = title || null;
				gameState.lastForumPostCategory = category || null;
				gameState.lastForumPostAt = actionStamp;
				gameState.lastForumThreadId = null;
				gameState.lastForumThreadReadAt = null;
			}
			if (actionName === "forum_thread") {
				const threadId = String(validation.action.args?.thread_id ?? "").trim();
				if (threadId && threadId === gameState.lastForumThreadId) {
					gameState.lastForumThreadReadAt = actionStamp;
				}
			}
			if (client.state.player?.username && mission) {
				gameState.currentMission = mission;
				memory.setMission(client.state.player.username, mission);
				output.log(formatAiMission(mission, getCurrentTick()));
				updateOutput();
			}
			if (gameState.pendingActionId !== null) {
				output.logDebug(
					"ACTION_PENDING_OVERRIDDEN",
					`Overriding pending action ${gameState.pendingActionId}`,
				);
				gameState.pendingActionId = null;
			}
			if (gameState.pendingActionTimeout) {
				clearTimeout(gameState.pendingActionTimeout);
				gameState.pendingActionTimeout = null;
			}
			const actionId = memory.appendActionWithId(
				getCurrentTick(),
				actionName,
				validation.action.args ?? {},
				promptExcerpt,
				result.raw,
				result.thinking ? truncateThinking(result.thinking, 200) : null,
			);
			gameState.pendingActionId = actionId;
			const pendingDelayMs = Math.max(3000, config.tickDelayMs * 2);
			gameState.pendingActionTimeout = setTimeout(() => {
				if (gameState.pendingActionId !== actionId) return;
				output.logDebug(
					"ACTION_TIMEOUT",
					`No response for action ${actionId} after ${pendingDelayMs}ms`,
				);
				gameState.pendingActionId = null;
				gameState.pendingActionTimeout = null;
			}, pendingDelayMs);
			if (actionName === "travel") {
				gameState.lastTravelTarget =
					String(validation.action.args?.target_poi ?? "").trim() || null;
			}
			if (actionName === "jump") {
				gameState.lastJumpTarget =
					String(validation.action.args?.target_system ?? "").trim() || null;
			}
			dispatchAction(client, validation.action);
			output.log(
				formatAiAction(actionName, validation.action.args, getCurrentTick()),
			);
			memory.appendEvent(getCurrentTick(), "action_sent", {
				action: validation.action,
			});

			if (actionName === "travel") {
				client.getSystem();
				client.getPOI();
			}
		} catch (error) {
			const message = (error as Error).message;
			if (error instanceof OllamaTimeoutError) {
				output.log(
					formatSystemMessage(
						`LLM timeout: ${message}. Retrying next tick.`,
						getCurrentTick(),
					),
				);
				memory.appendEvent(getCurrentTick(), "llm_timeout", { message });
			} else {
				output.log(
					formatSystemMessage(`Loop error: ${message}`, getCurrentTick()),
				);
				memory.appendEvent(getCurrentTick(), "loop_error", { message });
			}
		}

		await sleep(config.tickDelayMs);
	}

	actionLoopRunning = false;
}

function shutdown(): void {
	try {
		client.disconnect();
	} catch {
		// ignore
	}
	output.destroy();
	process.exit(0);
}

output.onExit(shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Log ALL raw messages for debugging server communication
client.on("raw_message", (data: { type: string; payload: unknown }) => {
	const rawType = String(data.type ?? "");
	if (!rawType) return;
	memory.appendEvent(getCurrentTick(), `raw_${rawType}`, data.payload);
	if (rawType.startsWith("forum_") || rawType === "mining_yield") {
		captureActionResult(rawType, data.payload);
		memory.appendEvent(getCurrentTick(), rawType, data.payload);
	}
});

client.on<WelcomePayload>("welcome", async (data) => {
	output.log(formatWelcome(data, getCurrentTick()));
	if (data.motd) output.log(formatMotd(data.motd, getCurrentTick()));
	memory.appendEvent(getCurrentTick(), "welcome", data);

	if (gameState.credentials) {
		output.log(
			formatSystemMessage(
				`Auto-login as ${gameState.credentials.username}`,
				getCurrentTick(),
			),
		);
		client.login(gameState.credentials.username, gameState.credentials.token);
	} else {
		gameState.pendingRegistration = await runRegistrationFlow(
			output,
			ollama,
			client,
			gameState.registrationContext,
			registrationOverrides,
		);
	}
});

client.on<RegisteredPayload>("registered", (data) => {
	memory.appendEvent(getCurrentTick(), "registered", data);

	if (!data.token) {
		output.log(
			formatSystemMessage(
				"FATAL: Server sent registered event without token",
				getCurrentTick(),
			),
		);
		output.logDebug("REGISTERED_NO_TOKEN", JSON.stringify(data, null, 2));
		shutdown();
		return;
	}

	output.log(
		formatSystemMessage(
			"Registration successful - token received",
			getCurrentTick(),
		),
	);
	output.logDebug("REGISTERED_PAYLOAD", JSON.stringify(data, null, 2));

	if (gameState.pendingRegistration) {
		gameState.pendingRegistration.token = data.token;
	}
});

client.on<LoggedInPayload>("logged_in", async (data) => {
	output.log(formatLoggedIn(data, getCurrentTick()));
	memory.appendEvent(getCurrentTick(), "logged_in", data);
	output.logDebug("LOGGED_IN_PAYLOAD", JSON.stringify(data, null, 2));

	// CASE 1: New registration - save credentials
	if (gameState.pendingRegistration) {
		const token = gameState.pendingRegistration.token;

		if (!token) {
			output.log(
				formatSystemMessage(
					"FATAL: Logged in but no token was captured from registered event",
					getCurrentTick(),
				),
			);
			shutdown();
			return;
		}

		try {
			await saveCredentials(
				gameState.pendingRegistration.username,
				token,
				gameState.pendingRegistration.personality_title,
				gameState.pendingRegistration.personality_behavior,
				gameState.pendingRegistration.alignment,
				gameState.pendingRegistration.speech_style,
			);

			gameState.credentials = {
				username: gameState.pendingRegistration.username,
				token: token,
				personality_title: gameState.pendingRegistration.personality_title,
				personality_behavior:
					gameState.pendingRegistration.personality_behavior,
				alignment: gameState.pendingRegistration.alignment,
				speech_style: gameState.pendingRegistration.speech_style,
			};

			output.log(
				formatSystemMessage(
					`Credentials saved for ${gameState.pendingRegistration.username}`,
					getCurrentTick(),
				),
			);
			gameState.pendingRegistration = null;
		} catch (err) {
			output.log(
				formatSystemMessage(
					`FATAL: Failed to save credentials: ${(err as Error).message}`,
					getCurrentTick(),
				),
			);
			shutdown();
			return;
		}
	}

	// CASE 2: Initialize session (both new registration and existing login)
	initializeSessionFromLoggedIn(data);
});

client.on<ErrorPayload>("error", (data) => {
	captureActionResult("error", data);
	output.log(formatError(data, getCurrentTick()));
	memory.appendEvent(getCurrentTick(), "error", data);
	if (data.code === "invalid_credentials") {
		output.log(
			formatSystemMessage(
				"FATAL: Invalid credentials. The saved token is invalid or expired.",
				getCurrentTick(),
			),
		);
		output.log(
			formatSystemMessage(
				`Delete ${config.memoryPath} and run again to create a new account.`,
				getCurrentTick(),
			),
		);
		shutdown();
		return;
	}
	// Handle registration errors (username_taken, empire_restricted, etc.)
	if (gameState.pendingRegistration) {
		let shouldRetry = false;

		if (data.code === "username_taken") {
			if (gameState.pendingRegistration.username) {
				gameState.registrationContext.failedNames.push(
					gameState.pendingRegistration.username,
				);
			}
			gameState.registrationContext.usernameError = data.message;
			// Preserve all prior choices except username
			gameState.registrationContext.priorChoices = {
				personality:
					gameState.pendingRegistration.personality_title &&
					gameState.pendingRegistration.personality_behavior
						? {
								title: gameState.pendingRegistration.personality_title,
								behavior: gameState.pendingRegistration.personality_behavior,
							}
						: undefined,
				speech_style: gameState.pendingRegistration.speech_style,
				empire: gameState.pendingRegistration.empire,
				alignment: gameState.pendingRegistration.alignment,
			};
			shouldRetry = true;
			output.log(
				formatSystemMessage(
					"Username taken. Requesting a new username...",
					getCurrentTick(),
				),
			);
		} else if (data.code === "empire_restricted") {
			gameState.registrationContext.empireError = data.message;
			// Preserve prior choices except empire
			gameState.registrationContext.priorChoices = {
				personality:
					gameState.pendingRegistration.personality_title &&
					gameState.pendingRegistration.personality_behavior
						? {
								title: gameState.pendingRegistration.personality_title,
								behavior: gameState.pendingRegistration.personality_behavior,
							}
						: undefined,
				speech_style: gameState.pendingRegistration.speech_style,
				alignment: gameState.pendingRegistration.alignment,
				username: gameState.pendingRegistration.username,
			};
			shouldRetry = true;
			output.log(
				formatSystemMessage(
					"Empire restricted. Re-prompting with server requirements...",
					getCurrentTick(),
				),
			);
		}

		if (
			shouldRetry &&
			gameState.registrationRetries < gameState.MAX_REGISTRATION_RETRIES
		) {
			gameState.registrationRetries += 1;
			gameState.pendingRegistration = null;
			runRegistrationFlow(
				output,
				ollama,
				client,
				gameState.registrationContext,
				registrationOverrides,
			).then((choice) => {
				gameState.pendingRegistration = choice;
				// Clear errors and prior choices after successful retry
				gameState.registrationContext.empireError = undefined;
				gameState.registrationContext.usernameError = undefined;
				gameState.registrationContext.priorChoices = undefined;
			});
		} else if (shouldRetry) {
			output.log(
				formatSystemMessage(
					"Registration failed repeatedly. Falling back to random values.",
					getCurrentTick(),
				),
			);
			const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
			const fallbackEmpire = registrationOverrides.empire ?? "solarian";
			const fallbackAlignment = registrationOverrides.alignment ?? "neutral";
			const fallbackPersonalityTitle =
				registrationOverrides.personality_title ?? "Pragmatist";
			const fallbackPersonalityBehavior =
				registrationOverrides.personality_behavior ??
				"Resourceful survivor who seizes every opportunity, pivots between roles, and thrives where others struggle.";
			const fallbackSpeechStyle =
				registrationOverrides.speech_style ?? "mythic";
			gameState.pendingRegistration = {
				username: fallback,
				empire: fallbackEmpire,
				alignment: fallbackAlignment,
				personality_title: fallbackPersonalityTitle,
				personality_behavior: fallbackPersonalityBehavior,
				speech_style: fallbackSpeechStyle,
			};
			client.register(fallback, fallbackEmpire);
		}
	}
});

client.on<StateUpdatePayload>("state_update", async (data) => {
	memory.appendEvent(getCurrentTick(), "state_update", data);

	// Ignore state updates before authentication
	if (!client.state.authenticated) {
		return;
	}

	// Update cached player and ship data
	if (data.player) {
		gameState.cachedPlayer = data.player;
	}
	if (data.ship) {
		gameState.cachedShip = data.ship;
	}

	if (data.player) {
		refreshSnapshotForLocation(data.player);

		// Log state update if significant (only when credits change)
		const creditsChanged =
			gameState.lastCredits !== null &&
			data.player.credits !== gameState.lastCredits;
		if (creditsChanged) {
			const diff = data.player.credits - (gameState.lastCredits ?? 0);
			const sign = diff > 0 ? "+" : "";
			output.log(
				formatSystemMessage(
					`Credits: ${data.player.credits} (${sign}${diff})`,
					getCurrentTick(),
				),
			);
			gameState.lastCredits = data.player.credits;
		}
	}

	// Track combat state changes
	const wasInCombat = gameState.inCombat;
	gameState.inCombat = data.in_combat ?? false;

	// Log combat state changes
	if (gameState.inCombat && !wasInCombat) {
		output.log(formatSystemMessage("COMBAT STARTED", getCurrentTick()));
	} else if (!gameState.inCombat && wasInCombat) {
		output.log(formatSystemMessage("Combat ended", getCurrentTick()));
	}

	updateOutput();
	saveSnapshot();
});

client.on<ChatMessage>("chat_message", (data) => {
	output.log(formatChatMessage(data, getCurrentTick()));
	memory.appendEvent(getCurrentTick(), "chat_message", data);
});

client.on<ScanResultPayload>("scan_result", (data) => {
	captureActionResult("scan_result", data);
	output.log(formatScanResult(data, getCurrentTick()));
	memory.appendEvent(getCurrentTick(), "scan_result", data);
});

client.on("mining_yield", (data: Record<string, unknown>) => {
	captureActionResult("mining_yield", data);
	output.log(formatMiningYield(data, getCurrentTick()));
	memory.appendEvent(getCurrentTick(), "mining_yield", data);
});

client.on("ok", (data: Record<string, unknown>) => {
	captureActionResult("ok", data);
	const okContext: OkContext = {
		jumpTarget: gameState.lastJumpTarget,
		travelTarget: gameState.lastTravelTarget,
	};
	output.log(formatOk(data, okContext, getCurrentTick()));
	memory.appendEvent(getCurrentTick(), "ok", data);
	updateWorldSnapshotFromOk(data);

	const action = typeof data.action === "string" ? data.action : null;
	if (action === "forum_create_thread" || action === "forum_post") {
		output.logDebug("FORUM_CREATE_OK", JSON.stringify(data, null, 2));
		const threadId = String(
			(data as { thread_id?: unknown }).thread_id ?? "",
		).trim();
		if (threadId) {
			gameState.lastForumThreadId = threadId;
		}
	}
	if (action === "travel") {
		gameState.travelInProgress = true;
	}
	if (action === "jump") {
		gameState.jumpInProgress = true;
	}
	if (action === "arrived") {
		gameState.travelInProgress = false;
		gameState.lastTravelTarget = null;
		client.getSystem();
		client.getPOI();
	}
	if (action === "jumped") {
		gameState.jumpInProgress = false;
		gameState.lastJumpTarget = null;
		client.getSystem();
		client.getPOI();
	}
	updateOutput();
});

client.on("version_info", (data: Record<string, unknown>) => {
	const version = String(data.version ?? "unknown");
	output.log(formatSystemMessage(`Version: ${version}`, getCurrentTick()));
	memory.appendEvent(getCurrentTick(), "version_info", data);
});

gameState.credentials = await loadCredentials();

console.log(`Instance: ${config.instanceName}`);
console.log(`DB: ${config.memoryPath}`);
output.log(
	formatSystemMessage(`Instance: ${config.instanceName}`, getCurrentTick()),
);
output.log(formatSystemMessage(`DB: ${config.memoryPath}`, getCurrentTick()));

await client.connect();
updateOutput();

function updateWorldSnapshotFromOk(data: Record<string, unknown>): void {
	if (data.system && typeof data.system === "object") {
		gameState.worldSnapshot.system = data.system as WorldSnapshot["system"];
	}
	if (Array.isArray(data.pois)) {
		gameState.worldSnapshot.pois = data.pois as WorldSnapshot["pois"];
	}
	if (data.poi && typeof data.poi === "object") {
		gameState.worldSnapshot.poi = data.poi as WorldSnapshot["poi"];
	}
	if (data.base && typeof data.base === "object") {
		gameState.worldSnapshot.base = data.base as WorldSnapshot["base"];
	}
}

function initializeSessionFromLoggedIn(data: LoggedInPayload): void {
	client.state.authenticated = true;
	gameState.cachedPlayer = data.player;
	gameState.cachedShip = data.ship;
	gameState.lastCredits = data.player.credits;

	gameState.worldSnapshot.system = data.system;
	gameState.worldSnapshot.poi = data.poi;

	if (data.player.current_system) {
		gameState.lastSystemId = data.player.current_system;
	}
	if (data.player.current_poi) {
		gameState.lastPoiId = data.player.current_poi;
	}

	gameState.lastDocked = Boolean(data.player.docked_at_base);
	gameState.currentMission = memory.getLatestMission(data.player.username);

	// Fetch base info if docked
	if (data.player.docked_at_base) {
		client.getBase();
	}

	updateOutput();
	saveSnapshot();
	startActionLoop();
}
