export interface OllamaResult<T> {
	raw: string;
	json: T;
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

	constructor(baseUrl: string, model: string, timeoutMs: number) {
		this.baseUrl = baseUrl;
		this.model = model;
		this.timeoutMs = timeoutMs;
	}

	async generateJson<T>(prompt: string): Promise<OllamaResult<T>> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const response = await fetch(new URL("/api/generate", this.baseUrl), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: this.model,
					prompt,
					stream: false,
					options: {
						temperature: 0.2,
					},
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Ollama error ${response.status}: ${text}`);
			}

			const data = (await response.json()) as { response?: string };
			const raw = data.response ?? "";
			const json = parseJsonFromText<T>(raw);

			return { raw, json };
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
