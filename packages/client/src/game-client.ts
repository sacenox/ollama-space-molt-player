import { GAME_API } from "./api-definition.ts";
import { getArchetypeListText } from "./archetypes.ts";
import type { GameDatabase } from "./db.ts";
import { formatPayload, logServerMessage } from "./logging.ts";
import { loadModelConfig } from "./model-config.ts";
import { OllamaClient } from "./ollama.ts";
import { PLAYER_API_REFERENCE } from "./player-api-reference.ts";
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

export class GameClient {
	private static readonly MAX_LOG_LENGTH = 500;

	private db: GameDatabase;
	private ws: GameWebSocketClient;
	private ollama: OllamaClient;
	private config: ClientConfig;
	private currentTick = 0;
	private lastProcessedTick = -1;
	private tickRate: number;
	private watchdogTimer: Timer | null = null;
	private isRunning = false;
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

		console.log(
			`[${config.instanceId}] Using model: ${config.model} (${modelConfig.ollama.model}), context: ${config.contextWindowSize} messages`,
		);

		this.ws = new GameWebSocketClient({
			url: config.serverUrl || "wss://game.spacemolt.com/ws",
			onMessage: (msg) => {
				this.handleServerMessage(msg).catch((error) => {
					console.error(`[${this.config.instanceId}] Unhandled error in message handler:`, error);
				});
			},
			onConnect: () => this.handleConnect(),
			onDisconnect: () => this.handleDisconnect(),
			onError: (err) => this.handleError(err),
		});
	}

	async start(): Promise<void> {
		console.log(`[${this.config.instanceId}] Starting game client...`);

		await this.ws.connect();
		this.isRunning = true;

		const activeUsername = this.db.getActiveUsername();
		if (activeUsername) {
			console.log(`[${this.config.instanceId}] Auto-login as ${activeUsername.username}`);
			this.ws.send({
				type: "login",
				payload: { username: activeUsername.username, token: activeUsername.token },
			});
		}
	}

	stop(): void {
		this.isRunning = false;
		if (this.watchdogTimer) {
			clearTimeout(this.watchdogTimer);
			this.watchdogTimer = null;
		}
		this.ws.disconnect();
		this.db.close();
		console.log(`[${this.config.instanceId}] Client stopped`);
	}

	private handleConnect(): void {
		console.log(`[${this.config.instanceId}] Connected to server`);
	}

	private handleDisconnect(): void {
		console.log(`[${this.config.instanceId}] Disconnected from server`);
	}

	private handleError(error: Error): void {
		console.error(`[${this.config.instanceId}] Error:`, error.message);
		this.db.saveMessage(this.currentTick, "client", {
			error: "Connection error occurred",
			code: "CONNECTION_ERROR",
		});
	}

	private async handleServerMessage(message: ServerMessage): Promise<void> {
		try {
			logServerMessage(this.config.instanceId || "default", message, this.config.verbose || false);

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
				default:
					this.db.saveMessage(this.currentTick, "server", message);
					break;
			}
		} catch (error) {
			console.error(`[${this.config.instanceId}] Error handling ${message.type} message:`, error);
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

		if (this.isRunning) {
			await this.processTick().catch((error) => {
				console.error(`[${this.config.instanceId}] Initial tick processing error:`, error);
				this.db.saveMessage(this.currentTick, "client", {
					error: "Initial tick processing failed",
					code: "TICK_PROCESSING_ERROR",
				});
			});
		}
	}

	private async handleTick(message: { payload: { tick: number } }): Promise<boolean> {
		const newTick = message.payload.tick;

		if (newTick <= this.lastProcessedTick) {
			console.log(`[${this.config.instanceId}] Ignoring duplicate or stale tick ${newTick}`);
			return false;
		}

		if (this.isProcessingTick) {
			console.log(
				`[${this.config.instanceId}] Skipping tick ${newTick}, still processing tick ${this.currentTick}`,
			);
			return false;
		}

		this.currentTick = newTick;
		this.isProcessingTick = true;

		this.startWatchdog();

		if (this.isRunning) {
			try {
				await this.processTick();
				this.lastProcessedTick = newTick;
			} catch (error) {
				console.error(`[${this.config.instanceId}] Tick processing error:`, error);
				this.db.saveMessage(this.currentTick, "client", {
					error: "Tick processing failed",
					code: "TICK_PROCESSING_ERROR",
				});
			} finally {
				this.isProcessingTick = false;
			}
		} else {
			this.lastProcessedTick = newTick;
			this.isProcessingTick = false;
		}

		return true;
	}

	private async handleRegistered(message: RegisteredMessage): Promise<void> {
		if (!this.registrationData) {
			return;
		}

		console.log(`[${this.config.instanceId}] Registration successful`);

		const archetypeList = getArchetypeListText(this.config.archetype);

		const promptGeneration = `You are creating a character for a sci-fi themed online multiplayer game called SpaceMolt. The character's name is "${this.registrationData.username}" and they belong to the "${this.registrationData.empire}" empire.

Choose a personality archetype from this list:
${archetypeList}

Generate a concise character prompt (1-2 sentences) that captures this character's personality, goals, and playstyle based on your chosen archetype. This prompt will guide all future decisions this character makes in the game.

Character prompt:`;

		try {
			const result = await this.ollama.generate(promptGeneration);

			if (result.thinking) {
				console.log(`[${this.config.instanceId}] Thinking: ${result.thinking}`);
			}

			this.db.saveUsername(
				this.registrationData.username,
				message.payload.token,
				result.response,
				message.payload.player_id,
				this.currentTick,
			);

			console.log(`[${this.config.instanceId}] Character prompt generated and saved`);
		} catch (error) {
			console.error(`[${this.config.instanceId}] Failed to generate prompt:`, error);

			this.db.saveUsername(
				this.registrationData.username,
				message.payload.token,
				`You are ${this.registrationData.username}, a ${this.registrationData.empire} player in SpaceMolt.`,
				message.payload.player_id,
				this.currentTick,
			);
		}

		this.waitingForRegistration = false;
		this.registrationData = null;
	}

	private handleLoggedIn(_message: LoggedInMessage): void {}

	private handleServerError(message: ErrorMessage): void {
		if (this.waitingForRegistration && this.registrationData) {
			console.log(`[${this.config.instanceId}] Registration failed, will retry on next tick`);
			this.waitingForRegistration = false;
		}
	}

	private startWatchdog(): void {
		if (this.watchdogTimer) {
			clearTimeout(this.watchdogTimer);
		}

		this.watchdogTimer = setTimeout(() => {
			console.warn(
				`[${this.config.instanceId}] No tick received for ${this.tickRate * 2}ms. Connection may be lost.`,
			);
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

		console.log(`[${this.config.instanceId}] Hint:`, hint || "(none)");

		const context = this.buildLLMContext(prompt, hint);

		try {
			const contextJson = JSON.stringify(context);
			const fullPrompt = `You are playing a online multiplayer game, be social, role play as the player and stay in character. Game Context:
			
${contextJson}

CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, just the JSON command.

JSON Format Rules:
- Actions WITH arguments: {"type": "action_name", "payload": {"arg1": "value1", "arg2": "value2"}}
- Actions WITHOUT arguments: {"type": "action_name"}

Examples:
- {"type": "action_name"} ← Correct (no payload needed)
- {"type": "action_name_with_arguments", "payload": {"target_poi": "sol_belt"}} ← Correct

NEVER write "undefined" or "null" as payload value. If an action has no arguments, omit the payload field entirely.

Your JSON response:`;
			const result = await this.ollama.generate(fullPrompt);

			if (result.thinking) {
				console.log(`[${this.config.instanceId}] Thinking:\n${result.thinking}`);
			}

			let command: BaseCommand;
			try {
				command = JSON.parse(result.response);
			} catch {
				command = this.extractJSON(result.response);
			}

			if (!command.type || typeof command.type !== "string") {
				console.error(`[${this.config.instanceId}] LLM response: ${result.response}`);
				throw new Error("Invalid command: missing or invalid 'type' field");
			}

			if (command.type === "register" && command.payload) {
				const payload = command.payload as { username: string; empire: string };
				this.waitingForRegistration = true;
				this.registrationData = {
					username: payload.username,
					empire: payload.empire,
				};
				console.log(
					`[${this.config.instanceId}] → register (username: ${payload.username}, empire: ${payload.empire})`,
				);
			} else if (command.type === "login" && command.payload) {
				const payload = command.payload as { username: string; token: string };
				this.db.updateUsernameLastUsed(payload.username, this.currentTick);
				console.log(
					`[${this.config.instanceId}] → ${command.type}${command.payload ? ` (${formatPayload(command.payload)})` : ""}`,
				);
			} else {
				console.log(
					`[${this.config.instanceId}] → ${command.type}${command.payload ? ` (${formatPayload(command.payload)})` : ""}`,
				);
			}

			this.ws.send(command);

			this.db.saveMessage(this.currentTick, "client", command);
		} catch (error) {
			console.error(`[${this.config.instanceId}] LLM generation failed:`, error);
			this.db.saveMessage(this.currentTick, "client", {
				error: error instanceof Error ? error.message : "LLM generation failed",
				code: "LLM_GENERATION_FAILED",
			});
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

		const truncated =
			text.length > GameClient.MAX_LOG_LENGTH
				? text.substring(0, GameClient.MAX_LOG_LENGTH) +
					`... (${text.length - GameClient.MAX_LOG_LENGTH} more chars)`
				: text;

		console.error(
			`[${this.config.instanceId}] Failed to parse LLM response. Raw response:`,
			truncated,
		);

		throw new Error("Response does not contain valid JSON command");
	}

	private buildLLMContext(prompt: string, hint: string | undefined): LLMContext {
		const messages = this.db.getMessages(this.config.contextWindowSize || 20);
		const history: HistoryEntry[] = messages.reverse().map((msg) => {
			try {
				return {
					sender: msg.sender,
					tick: msg.tick,
					data: JSON.parse(msg.data),
				};
			} catch (error) {
				console.error(
					`[${this.config.instanceId}] Failed to parse message at tick ${msg.tick}:`,
					error,
				);
				return {
					sender: msg.sender,
					tick: msg.tick,
					data: { error: "Failed to parse message data", code: "PARSE_ERROR" },
				};
			}
		});

		const usernames = this.db.getUsernames();
		const activeUsername = usernames.length > 0 ? usernames[0] : null;
		const accounts = usernames.map((u) => ({
			username: u.username,
			token: u.token,
			is_active: activeUsername ? u.username === activeUsername.username : false,
		}));

		return {
			character: prompt,
			hint,
			recent_game_messages: history,
			api: PLAYER_API_REFERENCE,
			accounts: {
				list: accounts,
				description: "List of registered usernames and login token",
			},
		};
	}
}
