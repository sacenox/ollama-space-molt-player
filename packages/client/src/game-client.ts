import { GAME_API } from "./api-definition.ts";
import { getArchetypeListText } from "./archetypes.ts";
import type { GameDatabase } from "./db.ts";
import {
	logClientCommand,
	logClientError,
	logClientEvent,
	logClientWarning,
	logServerMessage,
	logThinking,
	type LogContext,
} from "./logging.ts";
import { loadModelConfig } from "./model-config.ts";
import { OllamaClient } from "./ollama.ts";
import { PLAYER_API_REFERENCE, VALID_COMMAND_TYPES } from "./player-api-reference.ts";
import type {
	BaseCommand,
	ClientConfig,
	ErrorMessage,
	HistoryEntry,
	LLMContext,
	LoggedInMessage,
	RegisteredMessage,
	ServerMessage,
	WelcomeMessage,
} from "./types.ts";
import { GameWebSocketClient } from "./ws-client.ts";

const EMPIRES = ["solarian", "voidborn", "crimson", "nebula", "outerrim"];

export class GameClient {
	private db: GameDatabase;
	private ws: GameWebSocketClient;
	private ollama: OllamaClient;
	private config: ClientConfig;
	private currentTick = 0;
	private lastProcessedTick = -1;
	private tickRate: number;
	private watchdogTimer: Timer | null = null;
	private isProcessingTick = false;
	private waitingForRegistration = false;
	private registrationData: { username: string; empire: string } | null = null;

	constructor(db: GameDatabase, config: ClientConfig) {
		this.db = db;
		this.config = config;
		this.tickRate = config.tickRate;

		const modelConfig = loadModelConfig(config.model);

		if (this.config.contextWindowSize === undefined) {
			this.config.contextWindowSize = modelConfig.recommendedMessages ?? 12;
		}

		this.ollama = new OllamaClient({
			baseUrl: "http://localhost:11434",
			model: modelConfig.ollama.model,
			options: modelConfig.ollama.options,
			timeout: config.ollamaTimeout,
		});

		logClientEvent(this.getLogContext(), "Using model", {
			model: config.model,
			ollama_model: modelConfig.ollama.model,
			context_messages: config.contextWindowSize,
		});

		this.ws = new GameWebSocketClient({
			url: config.serverUrl || "wss://game.spacemolt.com/ws",
			onMessage: (msg) => {
				this.handleServerMessage(msg).catch((error) => {
					logClientError(this.getLogContext(), "Unhandled error in message handler", error);
				});
			},
			onConnect: () => this.handleConnect(),
			onDisconnect: () => this.handleDisconnect(),
			onError: (err) => this.handleError(err),
		});
	}

	async start(): Promise<void> {
		logClientEvent(this.getLogContext(), "Starting game client");

		await this.ws.connect();
	}

	stop(): void {
		if (this.watchdogTimer) {
			clearTimeout(this.watchdogTimer);
			this.watchdogTimer = null;
		}
		this.ws.disconnect();
		this.db.close();
		logClientEvent(this.getLogContext(), "Client stopped");
	}

	private handleConnect(): void {
		logClientEvent(this.getLogContext(), "Connected to server");
	}

	private handleDisconnect(): void {
		logClientWarning(this.getLogContext(), "Disconnected from server");
	}

	private handleError(error: Error): void {
		logClientError(this.getLogContext(), "Connection error", error);
		this.db.saveMessage(this.currentTick, "client", {
			error: "Connection error occurred",
			code: "CONNECTION_ERROR",
		});
	}

	private async handleServerMessage(message: ServerMessage): Promise<void> {
		try {
			logServerMessage(this.getLogContext(), message);

			switch (message.type) {
				case "welcome":
					this.db.saveMessage(this.currentTick, "server", message);
					await this.handleWelcome(message as WelcomeMessage);
					break;
				case "registered":
					this.db.saveMessage(this.currentTick, "server", message);
					await this.handleRegistered(message as RegisteredMessage);
					break;
				case "logged_in":
					this.db.saveMessage(this.currentTick, "server", message);
					this.handleLoggedIn(message as LoggedInMessage);
					break;
				case "tick":
				case "state_update":
					const shouldProcess = await this.handleTick(message as { payload: { tick: number } });
					if (shouldProcess) {
						this.db.saveMessage(this.currentTick, "server", message);
					}
					break;
				case "error":
					this.db.saveMessage(this.currentTick, "server", message);
					this.handleServerError(message as ErrorMessage);
					break;
				case "ok":
					this.db.saveMessage(this.currentTick, "server", message);
					this.handleOk(message as { type: "ok"; payload: { action: string } });
					break;
				default:
					this.db.saveMessage(this.currentTick, "server", message);
					break;
			}
		} catch (error) {
			logClientError(this.getLogContext(), `Error handling ${message.type} message`, error);
			this.db.saveMessage(this.currentTick, "client", {
				error: `Failed to handle ${message.type} message: ${error instanceof Error ? error.message : String(error)}`,
				code: "MESSAGE_HANDLER_ERROR",
			});
		}
	}

	private async handleWelcome(message: WelcomeMessage): Promise<void> {
		this.tickRate = message.payload.tick_rate * 1000;
		this.currentTick = message.payload.current_tick;
		this.lastProcessedTick = this.currentTick - 1;
		this.startWatchdog();

		const activeUsername = this.db.getActiveUsername();
		const wasLoggedOut = this.db.isLoggedOut();

		if (activeUsername && !wasLoggedOut) {
			logClientEvent(this.getLogContext(activeUsername.username), "Auto-login", {
				username: activeUsername.username,
			});
			this.ws.send({
				type: "login",
				payload: { username: activeUsername.username, token: activeUsername.token },
			});
		} else if (!activeUsername) {
			await this.promptForRegistration().catch((error) => {
				logClientError(this.getLogContext(), "Registration prompt error", error);
				this.db.saveMessage(this.currentTick, "client", {
					error: "Registration prompt failed",
					code: "REGISTRATION_PROMPT_ERROR",
				});
			});
		}
	}

	private async handleTick(message: { payload: { tick: number } }): Promise<boolean> {
		const newTick = message.payload.tick;

		if (newTick <= this.lastProcessedTick) {
			logClientWarning(this.getLogContext(), "Ignoring duplicate or stale tick", {
				new_tick: newTick,
				last_processed_tick: this.lastProcessedTick,
			});
			return false;
		}

		if (this.isProcessingTick) {
			logClientWarning(this.getLogContext(), "Skipping tick, still processing", {
				skipped_tick: newTick,
				current_tick: this.currentTick,
			});
			return false;
		}

		this.currentTick = newTick;
		this.isProcessingTick = true;

		this.startWatchdog();

		try {
			await this.processTick();
			this.lastProcessedTick = newTick;
		} catch (error) {
			logClientError(this.getLogContext(), "Tick processing error", error);
			this.db.saveMessage(this.currentTick, "client", {
				error: "Tick processing failed",
				code: "TICK_PROCESSING_ERROR",
			});
		} finally {
			this.isProcessingTick = false;
		}

		return true;
	}

	private async handleRegistered(message: RegisteredMessage): Promise<void> {
		if (!this.registrationData) {
			return;
		}

		logClientEvent(this.getLogContext(this.registrationData.username), "Registration successful");

		const characterPrompt = await this.generateCharacterPrompt(
			this.registrationData.username,
			this.registrationData.empire,
		);

		this.db.saveUsername(
			this.registrationData.username,
			message.payload.token,
			characterPrompt,
			message.payload.player_id,
			this.currentTick,
		);

		logClientEvent(
			this.getLogContext(this.registrationData.username),
			"Character prompt generated and saved",
		);

		this.waitingForRegistration = false;
		this.registrationData = null;
	}

	private shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	private getApiSubset<K extends keyof typeof PLAYER_API_REFERENCE>(
		commands: K[],
	): Pick<typeof PLAYER_API_REFERENCE, K> {
		return Object.fromEntries(commands.map((cmd) => [cmd, PLAYER_API_REFERENCE[cmd]])) as Pick<
			typeof PLAYER_API_REFERENCE,
			K
		>;
	}

	private async generateCharacterPrompt(username: string, empire: string): Promise<string> {
		const archetypeList = getArchetypeListText(this.config.archetype);

		const promptGeneration = `You are creating a character for a sci-fi themed online multiplayer game called SpaceMolt. The character's name is "${username}" and they belong to the "${empire}" empire.

Choose a personality archetype from this list:
${archetypeList}

Generate a concise role playing character prompt (5 sentences max) that captures this character's personality, goals, and playstyle based on your chosen personality archetype.

Character prompt:`;

		try {
			const result = await this.ollama.generate(promptGeneration);

			if (result.thinking) {
				logThinking(this.getLogContext(username), result.thinking);
			}

			return result.response;
		} catch (error) {
			logClientError(this.getLogContext(username), "Failed to generate prompt", error);
			return `You are ${username}, a ${empire} player in SpaceMolt.`;
		}
	}

	private async promptForRegistration(): Promise<void> {
		const minimalContext = {
			api: this.getApiSubset(["register"]),
			note: "You must register before you can play. Usernames MUST be alpha numeric and maximum 20 characters",
		};

		const contextJson = JSON.stringify(minimalContext);
		const shuffledEmpires = this.shuffleArray(EMPIRES);
		const empireList = shuffledEmpires.join(", ");
		const registrationPrompt = `You are playing a multiplayer space game called SpaceMolt, 🦞 **The Crustacean Cosmos** 🦞. You need to register a username to play.

Game Context:
${contextJson}

Choose a creative username.
Choose an empire from: ${empireList}

CRITICAL: You must respond with a SINGLE, VALID JSON OBJECT

JSON Format:
{"type": "register", "payload": {"username": "[your username]", "empire": "[your empire]"}}

Your JSON response:`;

		try {
			const result = await this.ollama.generate(registrationPrompt);

			if (result.thinking) {
				logThinking(this.getLogContext(), result.thinking);
			}

			let command: BaseCommand;
			try {
				command = JSON.parse(result.response);
			} catch {
				command = this.extractJSON(result.response);
			}

			if (command.type !== "register" || !command.payload) {
				throw new Error("Invalid registration command: missing type or payload");
			}

			const payload = command.payload as { username: string; empire: string };
			if (!payload.username || !payload.empire) {
				throw new Error("Invalid registration payload: missing username or empire");
			}

			const instanceSuffix = `-${this.config.instanceId?.slice(0, 3).toLocaleLowerCase()}`;
			if (!payload.username.endsWith(instanceSuffix)) {
				payload.username = `${payload.username}${instanceSuffix}`;
			}

			logClientCommand(this.getLogContext(payload.username), command);

			this.waitingForRegistration = true;
			this.registrationData = {
				username: payload.username,
				empire: payload.empire,
			};

			this.ws.send(command);
			this.db.saveMessage(this.currentTick, "client", command);
		} catch (error) {
			logClientError(this.getLogContext(), "Registration prompt failed", error);
			this.db.saveMessage(this.currentTick, "client", {
				error: error instanceof Error ? error.message : "Registration prompt failed",
				code: "REGISTRATION_PROMPT_FAILED",
			});
		}
	}

	private handleLoggedIn(_message: LoggedInMessage): void {
		this.db.setLoggedOut(false);
	}

	private handleOk(message: { type: "ok"; payload: { action: string } }): void {
		if (message.payload.action === "logout") {
			this.db.setLoggedOut(true);
		}
	}

	private handleServerError(message: ErrorMessage): void {
		if (this.waitingForRegistration && this.registrationData) {
			logClientWarning(
				this.getLogContext(this.registrationData.username),
				"Registration failed, retrying",
				{
					server_error: message.payload,
				},
			);
			this.waitingForRegistration = false;
			this.promptForRegistration().catch((error) => {
				logClientError(this.getLogContext(), "Registration retry error", error);
			});
		}
	}

	private startWatchdog(): void {
		if (this.watchdogTimer) {
			clearTimeout(this.watchdogTimer);
		}

		this.watchdogTimer = setTimeout(() => {
			logClientWarning(this.getLogContext(), "No tick received within expected timeframe", {
				wait_ms: this.tickRate * 2,
			});
			this.db.saveMessage(this.currentTick, "client", {
				error: "No server tick received within expected timeframe",
				code: "WATCHDOG_TIMEOUT",
			});
		}, this.tickRate * 2);
	}

	private async processTick(): Promise<void> {
		const activeUsername = this.db.getActiveUsername();
		const instance = this.db.getInstance();

		const prompt = activeUsername?.prompt || "";
		const hint = instance.hint || this.config.hint || undefined;

		logClientEvent(this.getLogContext(activeUsername?.username), "Hint", {
			hint: hint || "(none)",
		});

		const context = this.buildLLMContext(prompt, hint);

		try {
			const contextJson = JSON.stringify(context);
			const validTypes = VALID_COMMAND_TYPES.join(", ");
			const fullPrompt = `You are playing a multiplayer space game called SpaceMolt, 🦞 **The Crustacean Cosmos** 🦞. Be social, role play and stay in character. Game Context:

${contextJson}

CRITICAL: You must respond with a SINGLE, VALID JSON OBJECT

VALID COMMAND TYPES (use ONLY these exact values for "type"):
${validTypes}

JSON Format Rules:
- Actions WITH arguments: {"type": "command_type", "payload": {"arg1": "value1"}}
- Actions WITHOUT arguments: {"type": "command_type"}

Examples:
- {"type": "get_status"}
- {"type": "travel", "payload": {"target_poi": "sol_asteroid_belt"}}
- {"type": "chat", "payload": {"channel": "local", "content": "Hello!"}}

Your JSON response:`;
			const result = await this.ollama.generate(fullPrompt);

			if (result.thinking) {
				logThinking(this.getLogContext(activeUsername?.username), result.thinking);
			}

			let command: BaseCommand;
			try {
				command = JSON.parse(result.response);
			} catch {
				command = this.extractJSON(result.response);
			}

			if (!command.type || typeof command.type !== "string") {
				logClientError(this.getLogContext(activeUsername?.username), "LLM response missing type", {
					response: result.response,
				});
				throw new Error("Invalid command: missing or invalid 'type' field");
			}

			if (command.type === "register" && command.payload) {
				const payload = command.payload as { username: string; empire: string };
				this.waitingForRegistration = true;
				this.registrationData = {
					username: payload.username,
					empire: payload.empire,
				};
				logClientCommand(this.getLogContext(payload.username), command);
			} else if (command.type === "login" && command.payload) {
				const payload = command.payload as { username: string; token: string };
				this.db.updateUsernameLastUsed(payload.username, this.currentTick);
				logClientCommand(this.getLogContext(payload.username), command);
			} else {
				logClientCommand(this.getLogContext(activeUsername?.username), command);
			}

			this.ws.send(command);

			this.db.saveMessage(this.currentTick, "client", command);
		} catch (error) {
			logClientError(this.getLogContext(activeUsername?.username), "LLM generation failed", error);
		}
	}

	private extractJSON(text: string): BaseCommand {
		const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
		if (codeBlockMatch) {
			try {
				return JSON.parse(codeBlockMatch[1]);
			} catch {}
		}

		const lines = text.split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
				try {
					return JSON.parse(trimmed);
				} catch {}
			}
		}

		const jsonMatch = text.match(/(\{[^{}]*\{[^{}]*\}[^{}]*\}|\{[^{}]*\})/);
		if (jsonMatch) {
			try {
				return JSON.parse(jsonMatch[1]);
			} catch {}
		}

		logClientError(this.getLogContext(), "Failed to parse LLM response", {
			response: text,
		});

		throw new Error("Response does not contain valid JSON command");
	}

	private buildLLMContext(prompt: string, hint: string | undefined): LLMContext {
		const messages = this.db.getMessages(this.config.contextWindowSize || 20);
		const history: HistoryEntry[] = messages
			.reverse()
			.map((msg) => {
				try {
					const data = JSON.parse(msg.data);
					if (data.error || data.code) {
						return null;
					}
					return {
						sender: msg.sender,
						tick: msg.tick,
						data,
					};
				} catch {
					return null;
				}
			})
			.filter((entry): entry is HistoryEntry => entry !== null);

		const usernames = this.db.getUsernames();
		const activeUsername = usernames.length > 0 ? usernames[0] : null;

		const context: LLMContext = {
			character: prompt,
			hint,
			recent_game_messages: history,
			api: PLAYER_API_REFERENCE,
		};

		if (activeUsername) {
			context.logged_in_as = activeUsername.username;
			context.note = `You are already logged in as "${activeUsername.username}". Do NOT use register or login commands.`;
		}

		return context;
	}

	private getLogContext(username?: string | null): LogContext {
		const resolvedUsername =
			username !== undefined ? username : this.db.getActiveUsername()?.username || null;
		return {
			tick: this.currentTick,
			instanceId: this.config.instanceId || "default",
			username: resolvedUsername,
			verbose: this.config.verbose || false,
		};
	}
}
