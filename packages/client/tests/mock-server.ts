import type { Server, ServerWebSocket } from "bun";
import type { BaseCommand, ServerMessage } from "../src/types.ts";

export interface MockServerConfig {
	port?: number;
	tickRate?: number;
	autoTick?: boolean;
}

export class MockGameServer {
	private server: Server<unknown> | null = null;
	private clients: Set<ServerWebSocket<unknown>> = new Set();
	private port: number;
	private tickRate: number;
	private autoTick: boolean;
	private tickInterval: Timer | null = null;
	private currentTick = 0;
	private messageHandlers: Map<string, (data: BaseCommand) => ServerMessage> = new Map();

	constructor(config: MockServerConfig = {}) {
		this.port = config.port || 0;
		this.tickRate = config.tickRate || 10000;
		this.autoTick = config.autoTick || false;
	}

	async start(): Promise<void> {
		this.server = Bun.serve({
			port: this.port,
			websocket: {
				open: (ws) => {
					this.clients.add(ws);
					this.sendWelcome(ws);
				},
				message: (ws, message) => {
					this.handleMessage(ws, message);
				},
				close: (ws) => {
					this.clients.delete(ws);
				},
			},
			fetch: (req, server) => {
				const url = new URL(req.url);
				if (url.pathname === "/ws") {
					const upgraded = server.upgrade(req, { data: {} });
					if (!upgraded) {
						return new Response("WebSocket upgrade failed", { status: 400 });
					}
					return undefined;
				}
				return new Response("Not found", { status: 404 });
			},
		});

		if (this.port === 0 && this.server) {
			this.port = this.server.port ?? 0;
		}

		if (this.autoTick) {
			this.startTicking();
		}
	}

	stop(): void {
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
		if (this.server) {
			this.server.stop();
			this.server = null;
		}
		this.clients.clear();
	}

	getPort(): number {
		return this.port;
	}

	getUrl(): string {
		return `ws://localhost:${this.port}/ws`;
	}

	private sendWelcome(ws: ServerWebSocket<unknown>): void {
		const welcome: ServerMessage = {
			type: "welcome",
			payload: {
				version: "0.5.1",
				release_date: "2026-02-02",
				release_notes: ["Test server"],
				tick_rate: this.tickRate / 1000,
				current_tick: this.currentTick,
				server_time: Date.now(),
				game_info: "Mock SpaceMolt server for testing",
				website: "https://test.local",
				help_text: "Test help",
				terms: "Test terms",
			},
		};
		this.send(ws, welcome);
	}

	private handleMessage(ws: ServerWebSocket<unknown>, message: string | Buffer): void {
		try {
			const data = JSON.parse(
				typeof message === "string" ? message : message.toString(),
			) as BaseCommand;
			const handler = this.messageHandlers.get(data.type);

			if (handler) {
				const response = handler(data);
				this.send(ws, response);
			} else {
				this.send(ws, { type: "ok", payload: { action: data.type } });
			}
		} catch (_error) {
			this.send(ws, {
				type: "error",
				payload: {
					code: "invalid_payload",
					message: "Malformed JSON",
				},
			});
		}
	}

	onCommand(type: string, handler: (data: BaseCommand) => ServerMessage): void {
		this.messageHandlers.set(type, handler);
	}

	broadcast(message: ServerMessage): void {
		for (const client of this.clients) {
			this.send(client, message);
		}
	}

	send(ws: ServerWebSocket<unknown>, message: ServerMessage): void {
		ws.send(JSON.stringify(message));
	}

	sendToAll(message: ServerMessage): void {
		this.broadcast(message);
	}

	getClientCount(): number {
		return this.clients.size;
	}

	tick(): void {
		this.currentTick++;
		this.broadcast({
			type: "tick",
			payload: { tick: this.currentTick },
		});
	}

	private startTicking(): void {
		this.tickInterval = setInterval(() => {
			this.tick();
		}, this.tickRate);
	}

	getCurrentTick(): number {
		return this.currentTick;
	}

	setTick(tick: number): void {
		this.currentTick = tick;
	}

	sendRaw(data: string): void {
		for (const client of this.clients) {
			client.send(data);
		}
	}
}
