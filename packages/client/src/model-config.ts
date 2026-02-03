import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ModelConfig {
	displayName: string;
	description: string;
	ollama: {
		model: string;
		options: Record<string, unknown>;
	};
	contextWindow: number;
	recommended: boolean;
}

export interface ModelConfigFile {
	models: Record<string, ModelConfig>;
	default: string;
}

let cachedConfig: ModelConfigFile | null = null;

function getRepoRoot(): string {
	return join(__dirname, "../../..");
}

function loadConfigFile(): ModelConfigFile {
	if (cachedConfig) {
		return cachedConfig;
	}

	const configPath = join(getRepoRoot(), "player-models.json");

	try {
		const content = readFileSync(configPath, "utf-8");
		cachedConfig = JSON.parse(content) as ModelConfigFile;

		if (!cachedConfig.models || typeof cachedConfig.models !== "object") {
			throw new Error("Invalid player-models.json: missing 'models' object");
		}

		if (!cachedConfig.default || typeof cachedConfig.default !== "string") {
			throw new Error("Invalid player-models.json: missing 'default' field");
		}

		return cachedConfig;
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes("ENOENT")) {
				throw new Error(
					`Could not load player-models.json from repo root.\n\nExpected location: ${configPath}\n\nThe file must contain valid JSON with a "models" object and "default" field.\nSee documentation for schema details.`,
				);
			}
			throw error;
		}
		throw new Error("Unknown error loading player-models.json");
	}
}

export function loadModelConfig(configName?: string): ModelConfig {
	const configFile = loadConfigFile();

	const name = configName || configFile.default;

	if (!configFile.models[name]) {
		const available = Object.keys(configFile.models);
		throw new Error(
			`Model configuration "${name}" not found.\n\nAvailable models:\n${available.map((m) => `  - ${m}${configFile.models[m].recommended ? " (recommended)" : ""}`).join("\n")}\n\nCheck player-models.json for configuration details.`,
		);
	}

	return configFile.models[name];
}

export function listAvailableModels(): string[] {
	const configFile = loadConfigFile();
	return Object.keys(configFile.models);
}

export function getModelListText(): string {
	const configFile = loadConfigFile();
	return Object.entries(configFile.models)
		.map(
			([name, config]) =>
				`  ${name.padEnd(15)} ${config.displayName.padEnd(30)} ${config.recommended ? "(Recommended)" : ""}`,
		)
		.join("\n");
}
