export interface OllamaConfig {
	baseUrl: string;
	model: string;
	temperature: number;
	thinking: boolean;
	timeout: number;
}

export interface OllamaRequest {
	model: string;
	prompt: string;
	stream: boolean;
	options: {
		temperature: number;
		num_predict?: number;
		thinking?: boolean;
	};
}

export interface OllamaResponse {
	model: string;
	created_at: string;
	response: string;
	done: boolean;
}

export class OllamaClient {
	private config: OllamaConfig;

	constructor(config: Partial<OllamaConfig> = {}) {
		this.config = {
			baseUrl: config.baseUrl || "http://localhost:11434",
			model: config.model || "qwen3:8b",
			temperature: config.temperature || 1.2,
			thinking: config.thinking ?? false,
			timeout: config.timeout || 8000,
		};
	}

	async generate(prompt: string): Promise<string> {
		const url = `${this.config.baseUrl}/api/generate`;

		const request: OllamaRequest = {
			model: this.config.model,
			prompt,
			stream: false,
			options: {
				temperature: this.config.temperature,
			},
		};

		if (this.config.thinking) {
			request.options.thinking = true;
		}

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(request),
				signal: AbortSignal.timeout(this.config.timeout),
			});

			if (!response.ok) {
				throw new Error(`Ollama request failed with status ${response.status}`);
			}

			const data = (await response.json()) as OllamaResponse;

			if (!data.response) {
				throw new Error("Ollama response missing 'response' field");
			}

			return data.response.trim();
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "AbortError") {
					throw new Error(`Ollama request timed out after ${this.config.timeout}ms`);
				}
				throw new Error(`Ollama request failed: ${error.message}`);
			}
			throw new Error("Ollama request failed with unknown error");
		}
	}

	getConfig(): OllamaConfig {
		return { ...this.config };
	}

	updateConfig(config: Partial<OllamaConfig>): void {
		this.config = { ...this.config, ...config };
	}
}
