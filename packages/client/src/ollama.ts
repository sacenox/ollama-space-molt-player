export interface OllamaConfig {
	baseUrl: string;
	model: string;
	options: Record<string, unknown>;
	timeout: number;
}

export interface OllamaRequest {
	model: string;
	prompt: string;
	stream: boolean;
	options: Record<string, unknown>;
}

export interface OllamaResponse {
	model: string;
	created_at: string;
	response: string;
	thinking?: string;
	done: boolean;
}

export interface GenerateResult {
	response: string;
	thinking?: string;
}

export class OllamaClient {
	private config: OllamaConfig;

	constructor(config: OllamaConfig) {
		this.config = config;
	}

	async generate(prompt: string): Promise<GenerateResult> {
		const url = `${this.config.baseUrl}/api/generate`;

		const request: OllamaRequest = {
			model: this.config.model,
			prompt,
			stream: false,
			options: this.config.options,
		};

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

			return {
				response: data.response.trim(),
				thinking: data.thinking?.trim(),
			};
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
