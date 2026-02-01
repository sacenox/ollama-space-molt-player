export const config = {
	ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
	ollamaModel: process.env.OLLAMA_MODEL ?? "qwen3:8b",
	ollamaTemperature: (() => {
		const raw = process.env.OLLAMA_TEMPERATURE;
		if (!raw) return 0.5;
		const value = Number(raw);
		return Number.isFinite(value) ? value : 0.5;
	})(),
	ollamaThinking: process.env.OLLAMA_THINKING !== "false",
	spacemoltUrl: process.env.SPACEMOLT_URL ?? "wss://game.spacemolt.com/ws",
	debug: process.env.DEBUG === "true",
	memoryPath: process.env.MEMORY_DB ?? "memory.sqlite",
	credentialsFile: ".spacemolt-bot-credentials.json",
	tickDelayMs: 11000,
	maxContextActions: 5,
	maxContextEvents: 5,
	ollamaTimeoutMs: 60000,
};
