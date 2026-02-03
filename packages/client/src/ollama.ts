import type { OllamaTool } from "./mcp-client.ts";

export interface OllamaConfig {
	baseUrl: string;
	model: string;
	options: Record<string, unknown>;
	timeout: number;
}

export interface ChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	tool_calls?: ToolCall[];
}

export interface ToolCall {
	function: {
		name: string;
		arguments: Record<string, unknown>;
	};
}

interface OllamaChatRequest {
	model: string;
	messages: ChatMessage[];
	tools?: OllamaTool[];
	stream: boolean;
	options?: Record<string, unknown>;
}

interface OllamaChatResponse {
	model: string;
	created_at: string;
	message: {
		role: string;
		content: string;
		tool_calls?: ToolCall[];
	};
	done: boolean;
	done_reason?: string;
}

export interface ChatResult {
	content: string;
	toolCalls: ToolCall[];
	thinking?: string;
}

export class OllamaClient {
	private config: OllamaConfig;

	constructor(config: OllamaConfig) {
		this.config = config;
	}

	async chat(messages: ChatMessage[], tools?: OllamaTool[]): Promise<ChatResult> {
		const url = `${this.config.baseUrl}/api/chat`;

		const request: OllamaChatRequest = {
			model: this.config.model,
			messages,
			stream: false,
			options: this.config.options,
		};

		if (tools && tools.length > 0) {
			request.tools = tools;
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

			const data = (await response.json()) as OllamaChatResponse;

			const content = data.message?.content || "";
			const toolCalls = data.message?.tool_calls || [];

			const { cleanContent, thinking } = this.extractThinking(content);

			return {
				content: cleanContent,
				toolCalls,
				thinking,
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

	private extractThinking(content: string): { cleanContent: string; thinking?: string } {
		const thinkPattern = /<think>([\s\S]*?)<\/think>/g;
		const matches = Array.from(content.matchAll(thinkPattern));
		const blocks = matches
			.map((match) => match[1]?.trim() || "")
			.filter((block) => block.length > 0);
		const thinking = blocks.length > 0 ? blocks.join("\n") : undefined;
		const cleanContent = content.replace(thinkPattern, "").trim();
		return { cleanContent, thinking };
	}

	getConfig(): OllamaConfig {
		return { ...this.config };
	}

	updateConfig(config: Partial<OllamaConfig>): void {
		this.config = { ...this.config, ...config };
	}
}
