import { listArchetypes } from "./archetypes.ts";
import { listInstances } from "./db.ts";
import { getModelListText } from "./model-config.ts";
import type { ClientConfig } from "./types.ts";

export interface ParsedArgs {
	command: "start" | "update-hint" | "update-prompt" | "list-instances" | "help";
	config?: ClientConfig;
	instanceId?: string;
	hint?: string;
	prompt?: string;
	username?: string;
}

export function parseArgs(args: string[]): ParsedArgs {
	const cleanArgs = args;

	if (cleanArgs.length === 0 || cleanArgs[0] === "help" || cleanArgs[0] === "--help") {
		return { command: "help" };
	}

	const command = cleanArgs[0];

	if (command === "list-instances") {
		return { command: "list-instances" };
	}

	if (command === "update-hint") {
		const instanceId = getArg(cleanArgs, "--instance", "-i");
		const hint = getArg(cleanArgs, "--hint");

		if (!instanceId || !hint) {
			throw new Error("update-hint requires --instance and --hint");
		}

		return {
			command: "update-hint",
			instanceId,
			hint,
		};
	}

	if (command === "update-prompt") {
		const instanceId = getArg(cleanArgs, "--instance", "-i");
		const prompt = getArg(cleanArgs, "--prompt");
		const username = getArg(cleanArgs, "--username", "-u");

		if (!instanceId || !prompt || !username) {
			throw new Error("update-prompt requires --instance, --username, and --prompt");
		}

		return {
			command: "update-prompt",
			instanceId,
			prompt,
			username,
		};
	}

	if (command === "start" || command.startsWith("-")) {
		const config: ClientConfig = {
			instanceId: getArg(cleanArgs, "--instance", "-i"),
			hint: getArg(cleanArgs, "--hint"),
			model: getArg(cleanArgs, "--model", "-m") || "lfm-thinking",
			verbose: cleanArgs.includes("--verbose"),
			archetype: getArg(cleanArgs, "--archetype", "-a"),
			tickRate: 20000,
			ollamaTimeout: Number.parseInt(getArg(cleanArgs, "--ollama-timeout") || "30000"),
			serverUrl: getArg(cleanArgs, "--server", "-s"),
			contextWindowSize: Number.parseInt(getArg(cleanArgs, "--context-window", "-cw") || "20"),
		};

		return {
			command: "start",
			config,
		};
	}

	throw new Error(`Unknown command: ${command}`);
}

function getArg(args: string[], ...flags: string[]): string | undefined {
	for (const flag of flags) {
		const index = args.indexOf(flag);
		if (index !== -1 && index + 1 < args.length) {
			return args[index + 1];
		}
	}
	return undefined;
}

export function printHelp(): void {
	console.log(`
SpaceMolt LLM Game Client

USAGE:
  bun start [OPTIONS]
  bun start update-hint --instance <id> --hint <text>
  bun start update-prompt --instance <id> --username <name> --prompt <text>
  bun start list-instances
  bun start help

COMMANDS:
  start              Start the game client (default)
  update-hint        Update hint for an existing instance
  update-prompt      Update prompt for a specific username
  list-instances     List all database instances
  help               Show this help message

OPTIONS:
  -i, --instance <id>         Instance ID (4 chars). Auto-generated if not provided.
  --hint <text>               Hint message to inject into LLM context each tick
  -m, --model <name>          Model configuration name (default: lfm-thinking, see MODELS below)
  --verbose                   Enable detailed logging (shows full message payloads)
  -a, --archetype <name>      Restrict LLM to single archetype choice (diplomat, opportunist, agitator)
  --ollama-timeout <ms>       Ollama API timeout in milliseconds (default: 30000)
  -s, --server <url>          WebSocket server URL (default: wss://game.spacemolt.com/ws)
  -cw, --context-window <n>   Number of recent messages to include in LLM context (default: 20)

ARCHETYPES:
${listArchetypes()
	.map((a) => `  ${a.name.padEnd(15)} ${a.description}`)
	.join("\n")}

MODELS:
${getModelListText()}

  For full model details, see player-models.json at repo root.

EXAMPLES:
  # Start new game with default model (lfm-thinking)
  bun start

  # Start with specific instance ID and archetype
  bun start --instance abc1 --archetype diplomat

  # Use a different model configuration
  bun start --model qwen3 --archetype diplomat

  # Use DeepSeek for large context tasks
  bun start --model deepseek-r1 --archetype agitator

  # Start with hint and custom model
  bun start --hint "Focus on trading" --model qwen2.5

  # Update hint for existing instance
  bun start update-hint --instance abc1 --hint "New strategy: explore"

  # Update prompt for specific username
  bun start update-prompt --instance abc1 --username PlayerOne --prompt "You are a ruthless trader"

  # List all instances
  bun start list-instances
`);
}

export function printInstances(): void {
	const instances = listInstances();
	if (instances.length === 0) {
		console.log("No instances found.");
		return;
	}

	console.log("Available instances:");
	for (const id of instances) {
		console.log(`  - ${id}`);
	}
}
