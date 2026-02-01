export interface OllamaResult<T> {
	raw: string;
	json: T;
	thinking?: string;
}

export class OllamaTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`Ollama request timed out after ${timeoutMs}ms`);
		this.name = "OllamaTimeoutError";
	}
}

export class OllamaAgent {
	private baseUrl: string;
	private model: string;
	private timeoutMs: number;
	private temperature: number;
	private enableThinking: boolean;

	constructor(
		baseUrl: string,
		model: string,
		timeoutMs: number,
		temperature: number,
		enableThinking = true,
	) {
		this.baseUrl = baseUrl;
		this.model = model;
		this.timeoutMs = timeoutMs;
		this.temperature = temperature;
		this.enableThinking = enableThinking;
	}

	async generateJson<T>(prompt: string): Promise<OllamaResult<T>> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const requestBody: Record<string, unknown> = {
				model: this.model,
				prompt,
				stream: false,
				options: {
					temperature: this.temperature,
				},
			};

			// Enable thinking mode for Qwen3 models
			if (this.enableThinking) {
				requestBody.think = true;
			}

			const response = await fetch(new URL("/api/generate", this.baseUrl), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Ollama error ${response.status}: ${text}`);
			}

			const data = (await response.json()) as {
				response?: string;
				thinking?: string;
			};
			const raw = data.response ?? "";
			const thinking = data.thinking;
			const json = parseJsonFromText<T>(raw);

			return { raw, json, thinking };
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new OllamaTimeoutError(this.timeoutMs);
			}
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}

	async generateText(prompt: string): Promise<string> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const requestBody: Record<string, unknown> = {
				model: this.model,
				prompt,
				stream: false,
				options: {
					temperature: 0.1,
				},
			};

			const response = await fetch(new URL("/api/generate", this.baseUrl), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Ollama error ${response.status}: ${text}`);
			}

			const data = (await response.json()) as { response?: string };
			return (data.response ?? "").trim();
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new OllamaTimeoutError(this.timeoutMs);
			}
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}

function parseJsonFromText<T>(text: string): T {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error("No JSON object found in model response");
	}
	const slice = text.slice(start, end + 1);
	return JSON.parse(slice) as T;
}
