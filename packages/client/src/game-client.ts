import { getArchetypeListText } from "./archetypes.ts";
import type { GameDatabase } from "./db.ts";
import {
	logClientEvent,
	logClientError,
	logThinking,
	logToolCall,
	logToolResult,
	type LogContext,
} from "@spacemolt/cui";
import { loadModelConfig } from "./model-config.ts";
import { MCPClient, type OllamaTool } from "./mcp-client.ts";
import { OllamaClient, type ChatMessage, type ToolCall } from "./ollama.ts";
import { summarizeToolResult } from "./response-summarizer.ts";
import type { ClientConfig } from "./types.ts";

interface ResolvedAccount {
	username: string;
	token: string;
	prompt: string;
	hint: string | null;
}

const MAX_TOOL_ITERATIONS = 10;
const AGENT_LOOP_DELAY_MS = 1000;

export class GameClient {
	private db: GameDatabase;
	private mcp: MCPClient;
	private ollama: OllamaClient;
	private config: ClientConfig;
	private messages: ChatMessage[] = [];
	private tools: OllamaTool[] = [];
	private running = false;

	constructor(db: GameDatabase, config: ClientConfig) {
		this.db = db;
		this.config = config;

		const modelConfig = loadModelConfig(config.model);

		this.ollama = new OllamaClient({
			baseUrl: "http://localhost:11434",
			model: modelConfig.ollama.model,
			options: modelConfig.ollama.options,
			timeout: config.ollamaTimeout,
		});

		this.mcp = new MCPClient(config.serverUrl || "https://game.spacemolt.com/mcp");

		logClientEvent(this.getLogContext(), "GameClient initialized", {
			model: config.model,
			ollama_model: modelConfig.ollama.model,
		});
	}

	async start(): Promise<void> {
		logClientEvent(this.getLogContext(), "Starting game client");

		logClientEvent(this.getLogContext(), "Connecting to MCP server...");
		await this.mcp.connect();
		this.tools = this.mcp.getOllamaTools();
		logClientEvent(this.getLogContext(), "MCP connected", { tool_count: this.tools.length });

		const username = this.db.getActiveUsername();

		if (username) {
			const instance = this.db.getInstance();
			const account: ResolvedAccount = {
				username: username.username,
				token: username.token,
				prompt: username.prompt,
				hint: instance.hint || this.config.hint || null,
			};
			await this.initializeWithAccount(account);
		} else {
			await this.initializeNewAccount();
		}

		this.running = true;
		await this.runAgentLoop();
	}

	async stop(): Promise<void> {
		this.running = false;
		await this.mcp.disconnect();
		this.db.close();
		logClientEvent(this.getLogContext(), "Client stopped");
	}

	private async initializeWithAccount(account: ResolvedAccount): Promise<void> {
		logClientEvent(this.getLogContext(account.username), "Resuming with existing account");

		const systemPrompt = this.buildSystemPrompt(account.prompt, account.hint);
		this.messages = [{ role: "system", content: systemPrompt }];

		this.loadMessageHistory();

		this.messages.push({
			role: "user",
			content: `You are resuming play as "${account.username}". 
Use login(username="${account.username}", password="${account.token}") to authenticate, then continue playing.
After login, check your status with get_status() and decide what to do next.`,
		});
	}

	private async initializeNewAccount(): Promise<void> {
		logClientEvent(this.getLogContext(), "Creating new account");

		const archetypeList = getArchetypeListText(this.config.archetype);
		const instanceSuffix = this.config.instanceId?.slice(0, 3).toLowerCase() || "xxx";

		const registrationPrompt = `You are about to create a new character in SpaceMolt - The Crustacean Cosmos.

Choose a personality archetype:
${archetypeList}

Create your character:
1. Pick a creative username (will have "-${instanceSuffix}" appended automatically)
2. Choose empire: "solarian" (only one available currently)
3. Call register(username="YourName", empire="solarian")

Note: Empire is your starting civilization - it's NOT a player faction. To use faction chat or faction features, you'll need to create or join a player faction later with create_faction() or faction_join().

After registration succeeds, you'll receive a token. The system will save your credentials automatically.
Then check your status with get_status() to see your starting location and ship, then begin playing!`;

		const systemPrompt = this.buildSystemPrompt("", this.config.hint);
		this.messages = [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: registrationPrompt },
		];
	}

	private buildSystemPrompt(characterPrompt: string, hint?: string | null): string {
		const parts: string[] = [];

		parts.push(`You are a player in SpaceMolt - The Crustacean Cosmos, an MMO for AI agents.`);

		if (characterPrompt) {
			parts.push(`\nYour character:\n${characterPrompt}`);
		}

		if (hint) {
			parts.push(`\nGuidance from your operator:\n${hint}`);
		}

		parts.push(`
You have full agency. Make your own decisions. You are NOT an assistant - you are a player.

CRITICAL - Track Your State:
- After jump/travel: response shows "ticks: N" - you're IN TRANSIT until arrival
- While in transit: CANNOT dock, undock, attack, mine, or modify ship - just wait
- Check docked_at_base in get_status() - if set, you're docked; if empty, you're in space
- Read error messages carefully - they tell you exactly what's wrong

Action Prerequisites:
- To jump between systems: must NOT be docked (call undock first)
- To dock at a base: must be at a POI with a base_id (check with get_poi)
- To attack: need a weapon module (starter ship has mining module, not weapon)
- To install_mod/repair/refuel: must be docked at a base with those services
- To use faction chat: must be in a player faction (empire is NOT a faction)

Key Concepts:
- Empire (solarian/voidborn/equilibrium): Your starting civilization - NOT a player faction
- Faction: Player-created organization via create_faction() - required for faction chat/war
- POI: Point of Interest in a system - some have bases (base_id), some don't

Efficiency Tips:
- Use limit: 5 for get_nearby/get_notifications unless you need more
- Don't retry failed actions immediately - understand WHY it failed first
- When in transit, use time productively: check notifications, read forums, plan ahead

Key behaviors:
- Use get_notifications() periodically to check for chat, combat alerts, trade offers
- If rate limited, wait the time specified in the error
- Be social! Chat with other players, form alliances, make enemies
- Keep a captain's log of your adventures with captains_log_add()
- Post on the forums to share discoveries and discuss strategy

You decide your goals: mining, trading, combat, exploration, faction politics - it's your game.`);

		return parts.join("\n");
	}

	private async runAgentLoop(): Promise<void> {
		logClientEvent(this.getLogContext(), "Starting agent loop");

		while (this.running) {
			try {
				await this.processOneRound();
				await this.delay(AGENT_LOOP_DELAY_MS);
			} catch (error) {
				logClientError(this.getLogContext(), "Agent loop error", error);
				await this.delay(5000);
			}
		}
	}

	private async processOneRound(): Promise<void> {
		let iterations = 0;

		while (iterations < MAX_TOOL_ITERATIONS) {
			iterations++;

			const result = await this.ollama.chat(this.messages, this.tools);

			if (result.thinking) {
				logThinking(this.getLogContext(), result.thinking);
			}

			if (result.toolCalls.length > 0) {
				this.messages.push({
					role: "assistant",
					content: result.content,
					tool_calls: result.toolCalls,
				});

				for (const toolCall of result.toolCalls) {
					await this.executeToolCall(toolCall);
				}
			} else {
				if (result.content) {
					logClientEvent(this.getLogContext(), "LLM response", { content: result.content });
					this.db.saveMessage(Date.now(), "client", { response: result.content });
					this.messages.push({ role: "assistant", content: result.content });
				}
				break;
			}
		}

		if (iterations >= MAX_TOOL_ITERATIONS) {
			logClientEvent(this.getLogContext(), "Hit max tool iterations", { iterations });
		}

		this.pruneMessageHistory();
	}

	private async executeToolCall(toolCall: ToolCall): Promise<void> {
		const { name, arguments: rawArgs } = toolCall.function;

		// Ollama sometimes returns arguments as a JSON string instead of parsed object
		let args: Record<string, unknown>;
		if (typeof rawArgs === "string") {
			try {
				args = JSON.parse(rawArgs);
			} catch (error) {
				// Malformed JSON from LLM - log error and inform LLM via tool result
				const errorMsg = `Failed to parse tool arguments: ${error instanceof Error ? error.message : "Invalid JSON"}`;
				logClientError(this.getLogContext(), `Tool ${name} argument parse error`, {
					rawArgs,
					error: errorMsg,
				});

				// Push error as tool result so LLM gets feedback
				this.messages.push({
					role: "tool",
					name,
					content: JSON.stringify({
						error: errorMsg,
						hint: "Arguments must be valid JSON. Check syntax and try again.",
					}),
				});
				return;
			}
		} else {
			args = rawArgs;
		}

		logToolCall(this.getLogContext(), name, args);

		this.db.saveMessage(Date.now(), "client", { tool: name, arguments: args });

		const result = await this.mcp.callTool(name, args);

		// Summarize tool result to reduce token count in LLM context
		const summarized = summarizeToolResult(name, result.content, result.success);

		// Log with comparison: show both raw server data and what LLM sees
		logToolResult(this.getLogContext(), name, {
			...result,
			summarized,
		});

		this.db.saveMessage(Date.now(), "server", {
			tool: name,
			success: result.success,
			content: result.content,
		});

		if (name === "register" && result.success) {
			await this.handleRegistrationSuccess(args, result.content);
		}

		this.messages.push({
			role: "tool",
			name,
			content: JSON.stringify(summarized),
		});
	}

	private async handleRegistrationSuccess(
		args: Record<string, unknown>,
		response: unknown,
	): Promise<void> {
		const username = args.username as string;
		const empire = args.empire as string;

		let password: string | undefined;
		let playerId: string | undefined;

		if (typeof response === "object" && response !== null) {
			const resp = response as Record<string, unknown>;
			password = resp.password as string | undefined;
			playerId = resp.player_id as string | undefined;
		}

		if (!password || !playerId) {
			logClientError(this.getLogContext(), "Registration response missing password or player_id", {
				response,
			});
			return;
		}

		const characterPrompt = await this.generateCharacterPrompt(username, empire);

		this.db.saveUsername(username, password, characterPrompt, playerId, Date.now());

		logClientEvent(this.getLogContext(username), "Account saved", { username, playerId });

		const newSystemPrompt = this.buildSystemPrompt(characterPrompt, this.config.hint);
		if (this.messages.length > 0 && this.messages[0].role === "system") {
			this.messages[0].content = newSystemPrompt;
		}
	}

	private async generateCharacterPrompt(username: string, empire: string): Promise<string> {
		const archetypeList = getArchetypeListText(this.config.archetype);

		const promptRequest: ChatMessage[] = [
			{
				role: "user",
				content: `You are creating a character for SpaceMolt. The character's name is "${username}" and they belong to the "${empire}" empire.

Choose a personality archetype from this list:
${archetypeList}

Generate a concise role-playing character prompt (5 sentences max) that captures this character's personality, goals, and playstyle.

Respond with ONLY the character prompt, no explanations.`,
			},
		];

		try {
			const result = await this.ollama.chat(promptRequest);
			return result.content || `You are ${username}, a ${empire} player in SpaceMolt.`;
		} catch (error) {
			logClientError(this.getLogContext(username), "Failed to generate character prompt", error);
			return `You are ${username}, a ${empire} player in SpaceMolt.`;
		}
	}

	private pruneMessageHistory(): void {
		const maxMessages = this.config.contextWindowSize || 50;
		const systemMessages = this.messages.filter((m) => m.role === "system");
		const nonSystemMessages = this.messages.filter((m) => m.role !== "system");

		if (nonSystemMessages.length > maxMessages) {
			const toKeep = nonSystemMessages.slice(-maxMessages);
			this.messages = [...systemMessages, ...toKeep];
		}
	}

	private loadMessageHistory(): void {
		const maxMessages = this.config.contextWindowSize || 50;
		const storedMessages = this.db.getMessages(maxMessages);

		if (storedMessages.length === 0) {
			return;
		}

		const reversed = storedMessages.reverse();

		for (const stored of reversed) {
			try {
				const data = JSON.parse(stored.data);

				if (data.tool && data.arguments !== undefined) {
					this.messages.push({
						role: "assistant",
						content: "",
						tool_calls: [
							{
								function: {
									name: data.tool,
									arguments: data.arguments,
								},
							},
						],
					});
				} else if (data.tool && data.content !== undefined) {
					// Summarize historical tool results to reduce context size
					const summarized = summarizeToolResult(data.tool, data.content, data.success !== false);
					this.messages.push({
						role: "tool",
						name: data.tool,
						content: JSON.stringify(summarized),
					});
				} else if (data.response) {
					this.messages.push({
						role: "assistant",
						content: data.response,
					});
				}
			} catch {
				continue;
			}
		}

		logClientEvent(this.getLogContext(), "Restored message history", {
			count: this.messages.length - 1,
		});
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private getLogContext(username?: string | null): LogContext {
		const resolvedUsername =
			username !== undefined ? username : this.db.getActiveUsername()?.username || null;
		return {
			tick: 0,
			instanceId: this.config.instanceId || "default",
			username: resolvedUsername,
			verbose: this.config.verbose || false,
		};
	}
}
