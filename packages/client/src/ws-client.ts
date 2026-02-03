import type { BaseCommand, ServerMessage } from "./types.ts";

export interface WebSocketClientConfig {
	url: string;
	reconnect?: boolean;
	onMessage?: (message: ServerMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: Error) => void;
}

export class GameWebSocketClient {
	private ws: WebSocket | null = null;
	private config: WebSocketClientConfig;
	private reconnectAttempt = 0;
	private reconnectTimer: Timer | null = null;
	private shouldReconnect = true;
	private isConnected = false;

	private readonly reconnectDelays = [100, 200, 400, 800, 1600, 5000];

	constructor(config: WebSocketClientConfig) {
		this.config = { reconnect: true, ...config };
	}

	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			let resolved = false;

			try {
				this.ws = new WebSocket(this.config.url);

				this.ws.onopen = () => {
					this.isConnected = true;
					this.reconnectAttempt = 0;
					resolved = true;
					if (this.config.onConnect) {
						this.config.onConnect();
					}
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const data = event.data;

						if (data === null || data === undefined) {
							console.warn("[WebSocket] Received null/undefined message, skipping");
							return;
						}

						if (typeof data !== "string") {
							console.warn(
								`[WebSocket] Received non-string message (type: ${typeof data}, constructor: ${data?.constructor?.name}), skipping`,
							);
							return;
						}

						if (data.trim() === "") {
							console.warn("[WebSocket] Received empty message, skipping");
							return;
						}

						const messages = this.splitConcatenatedMessages(data);

						for (const messageData of messages) {
							const message = JSON.parse(messageData) as ServerMessage;
							if (this.config.onMessage) {
								this.config.onMessage(message);
							}
						}
					} catch (error) {
						const data = event.data;
						const dataType = typeof data;
						const dataPreview =
							typeof data === "string"
								? data.length > 200
									? `${data.substring(0, 200)}...`
									: data
								: `[${dataType}]`;

						console.error(
							`[WebSocket] Failed to parse message. Type: ${dataType}, Length: ${data?.length ?? "N/A"}, Preview: ${dataPreview}`,
						);

						if (this.config.onError) {
							this.config.onError(
								new Error(
									`Failed to parse message: ${error instanceof Error ? error.message : String(error)}`,
								),
							);
						}
					}
				};

				this.ws.onerror = (_event) => {
					const error = new Error("WebSocket error occurred");
					if (this.config.onError) {
						this.config.onError(error);
					}

					if (!resolved) {
						reject(error);
					}
				};

				this.ws.onclose = () => {
					this.isConnected = false;
					if (this.config.onDisconnect) {
						this.config.onDisconnect();
					}

					if (this.shouldReconnect && this.config.reconnect) {
						this.scheduleReconnect();
					}
				};
			} catch (error) {
				reject(error);
			}
		});
	}

	private splitConcatenatedMessages(data: string): string[] {
		const messages: string[] = [];
		let depth = 0;
		let start = 0;
		let inString = false;
		let escapeNext = false;

		for (let i = 0; i < data.length; i++) {
			const char = data[i];

			if (escapeNext) {
				escapeNext = false;
				continue;
			}

			if (char === "\\") {
				escapeNext = true;
				continue;
			}

			if (char === '"') {
				inString = !inString;
				continue;
			}

			if (inString) {
				continue;
			}

			if (char === "{") {
				depth++;
			} else if (char === "}") {
				depth--;

				if (depth === 0) {
					messages.push(data.substring(start, i + 1));
					start = i + 1;

					while (start < data.length && /\s/.test(data[start])) {
						start++;
					}
					i = start - 1;
				}
			}
		}

		if (messages.length === 0 && data.trim().length > 0) {
			messages.push(data);
		}

		return messages;
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		const delay =
			this.reconnectDelays[Math.min(this.reconnectAttempt, this.reconnectDelays.length - 1)];

		this.reconnectTimer = setTimeout(() => {
			this.reconnectAttempt++;
			this.connect().catch(() => {});
		}, delay);
	}

	send(command: BaseCommand): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error("WebSocket not connected");
		}

		this.ws.send(JSON.stringify(command));
	}

	disconnect(): void {
		this.shouldReconnect = false;

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.isConnected = false;
	}

	isConnectionOpen(): boolean {
		return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
	}

	getReconnectAttempts(): number {
		return this.reconnectAttempt;
	}
}
