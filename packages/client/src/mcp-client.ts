import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_SCHEMA_PATCHES } from "./tool-schemas.ts";

export interface OllamaTool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: string;
			properties: Record<string, unknown>;
			required: string[];
		};
	};
}

export interface ToolCallResult {
	success: boolean;
	content: unknown;
	error?: string;
}

export class MCPClient {
	private client: Client;
	private transport: StreamableHTTPClientTransport | null = null;
	private tools: MCPTool[] = [];
	private serverUrl: string;

	constructor(serverUrl: string = "https://game.spacemolt.com/mcp") {
		this.serverUrl = serverUrl;
		this.client = new Client({
			name: "spacemolt-ollama-player",
			version: "1.0.0",
		});
	}

	async connect(): Promise<void> {
		const url = new URL(this.serverUrl);
		this.transport = new StreamableHTTPClientTransport(url);
		await this.client.connect(this.transport);

		const toolsResponse = await this.client.listTools();
		this.tools = toolsResponse.tools;
	}

	async disconnect(): Promise<void> {
		if (this.transport) {
			await this.client.close();
			this.transport = null;
		}
	}

	getMCPTools(): MCPTool[] {
		return this.tools;
	}

	getOllamaTools(): OllamaTool[] {
		return this.tools.map((tool) => this.convertToOllamaTool(tool));
	}

	private convertToOllamaTool(mcpTool: MCPTool): OllamaTool {
		const inputSchema = mcpTool.inputSchema || { type: "object", properties: {}, required: [] };

		// Get server-provided schema
		let properties = (inputSchema.properties as Record<string, unknown>) || {};
		let required = (inputSchema.required as string[]) || [];

		// Apply local schema patches if server schema is empty
		// (SpaceMolt MCP server doesn't provide parameter schemas)
		const patch = TOOL_SCHEMA_PATCHES[mcpTool.name];
		if (patch && Object.keys(properties).length === 0) {
			properties = patch.properties;
			required = patch.required;
		}

		return {
			type: "function",
			function: {
				name: mcpTool.name,
				description: mcpTool.description || "",
				parameters: {
					type: inputSchema.type as string,
					properties,
					required,
				},
			},
		};
	}

	async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
		try {
			const result = await this.client.callTool({ name, arguments: args });

			const content = result.content;
			let parsedContent: unknown = content;

			if (Array.isArray(content) && content.length > 0) {
				const firstItem = content[0];
				if (firstItem && typeof firstItem === "object" && "text" in firstItem) {
					const textContent = (firstItem as { text: string }).text;
					try {
						parsedContent = JSON.parse(textContent);
					} catch {
						parsedContent = textContent;
					}
				}
			}

			return {
				success: !result.isError,
				content: parsedContent,
				error: result.isError ? String(parsedContent) : undefined,
			};
		} catch (error) {
			return {
				success: false,
				content: null,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	isConnected(): boolean {
		return this.transport !== null;
	}

	getToolCount(): number {
		return this.tools.length;
	}
}
