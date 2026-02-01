import { SpaceMoltClient } from "../client/src/client";
import type {
  WelcomePayload,
  RegisteredPayload,
  LoggedInPayload,
  ErrorPayload,
  StateUpdatePayload,
  ChatMessage,
  ScanResultPayload,
  EmpireID,
} from "../client/src/types";
import { config } from "./config";
import { MemoryStore } from "./memory";
import { OllamaAgent, OllamaTimeoutError } from "./ollama";
import { buildActionPrompt, buildRegistrationPrompt, type WorldSnapshot } from "./prompt";
import { dispatchAction, validateAction } from "./actions";
import { Tui } from "./tui";

type Credentials = { username: string; token: string };
type RegistrationChoice = { username: string; empire: EmpireID };

const memory = new MemoryStore(config.memoryPath);
const ollama = new OllamaAgent(config.ollamaUrl, config.ollamaModel, config.ollamaTimeoutMs);
const tui = new Tui();

const client = new SpaceMoltClient({
  url: config.spacemoltUrl,
  debug: config.debug,
  reconnect: true,
});

let credentials: Credentials | null = null;
let pendingRegistration: RegistrationChoice | null = null;
let includeHelpInPrompt = true;
let actionLoopRunning = false;
let worldSnapshot: WorldSnapshot = {};
let registrationRetries = 0;
const MAX_REGISTRATION_RETRIES = 3;
const failedRegistrationNames: string[] = [];

async function loadCredentials(): Promise<Credentials | null> {
  try {
    const file = Bun.file(config.credentialsFile);
    if (await file.exists()) {
      return (await file.json()) as Credentials;
    }
  } catch {
    return null;
  }
  return null;
}

async function saveCredentials(username: string, token: string): Promise<void> {
  const data: Credentials = { username, token };
  await Bun.write(config.credentialsFile, JSON.stringify(data, null, 2));
}

function log(message: string): void {
  tui.log(message);
}

function updateStatus(): void {
  const state = client.state;
  if (!state.player || !state.ship) {
    tui.setStatus("Not logged in");
    return;
  }
  const location = `${state.system?.name ?? state.player.current_system} - ${
    state.poi?.name ?? state.player.current_poi
  }`;
  const status = [
    `Player ${state.player.username} [${state.player.empire}]`,
    `Cr ${state.player.credits}`,
    `Hull ${state.ship.hull}/${state.ship.max_hull}`,
    `Shield ${state.ship.shield}/${state.ship.max_shield}`,
    `Fuel ${state.ship.fuel}/${state.ship.max_fuel}`,
    `Docked ${state.player.docked_at_base ? "Y" : "N"}`,
    `Tick ${state.currentTick}`,
    location,
  ].join(" | ");
  tui.setStatus(status);
}

function saveSnapshot(): void {
  memory.saveSnapshot({
    tick: client.state.currentTick,
    player: client.state.player,
    ship: client.state.ship,
    system: client.state.system,
    poi: client.state.poi,
    base: client.state.base,
    nearby: client.state.nearby,
  });
}

async function runRegistrationFlow(): Promise<void> {
  log("No credentials found. Asking LLM to create a character...");
  let attempts = 0;
  while (attempts < 3) {
    attempts += 1;
    try {
      const prompt = buildRegistrationPrompt(true, failedRegistrationNames);
      const result = await ollama.generateJson<RegistrationChoice>(prompt);
      const username = String(result.json.username ?? "").trim();
      const empire = String(result.json.empire ?? "").trim() as EmpireID;
      if (!username || !isValidEmpire(empire)) {
        throw new Error("Invalid registration response");
      }
      pendingRegistration = { username, empire };
      log(`Registering new account: ${username} (${empire})`);
      client.register(username, empire);
      return;
    } catch (error) {
      log(`Registration attempt failed: ${(error as Error).message}`);
    }
  }

  const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
  pendingRegistration = { username: fallback, empire: "solarian" };
  log(`Falling back to account: ${fallback} (solarian)`);
  client.register(fallback, "solarian");
}

function isValidEmpire(empire: string): empire is EmpireID {
  return ["solarian", "voidborn", "crimson", "nebula", "outerrim"].includes(empire);
}

async function startActionLoop(): Promise<void> {
  if (actionLoopRunning) return;
  actionLoopRunning = true;

  while (client.state.authenticated) {
    try {
      const recentActions = memory.getRecentActions(config.maxContextActions);
      const recentEvents = memory.getRecentEvents(config.maxContextEvents);
      const prompt = buildActionPrompt({
        state: client.state,
        worldSnapshot,
        recentActions,
        recentEvents,
        includeHelp: includeHelpInPrompt,
      });

      const promptExcerpt = prompt.slice(0, 1000);
      const result = await ollama.generateJson(prompt);
      const validation = validateAction(result.json);
      if (!validation.ok || !validation.action) {
        const message = `Invalid action from LLM: ${validation.error ?? "unknown"}`;
        log(message);
        memory.appendEvent("llm_invalid_action", { error: validation.error, raw: result.raw });
        includeHelpInPrompt = true;
        await sleep(config.tickDelayMs);
        continue;
      }

      memory.appendAction(
        validation.action.action,
        validation.action.args ?? {},
        promptExcerpt,
        result.raw
      );
      includeHelpInPrompt = false;

      const actionLog = dispatchAction(client, validation.action);
      log(`Action: ${actionLog}`);
      memory.appendEvent("action_sent", { action: validation.action });

      if (validation.action.action === "travel") {
        client.getSystem();
        client.getPOI();
      }
    } catch (error) {
      const message = (error as Error).message;
      if (error instanceof OllamaTimeoutError) {
        log(`LLM timeout: ${message}. Retrying next tick.`);
        memory.appendEvent("llm_timeout", { message });
      } else {
        log(`Loop error: ${message}`);
        memory.appendEvent("loop_error", { message });
      }
      includeHelpInPrompt = true;
    }

    await sleep(config.tickDelayMs);
  }

  actionLoopRunning = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatOkPayload(payload: Record<string, unknown>): string {
  if (payload.action) {
    return `OK ${payload.action}`;
  }
  const summary = summarizeOkPayload(payload);
  if (summary) return `OK ${summary}`;
  return `OK ${safeJson(payload)}`;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function summarizeOkPayload(payload: Record<string, unknown>): string | null {
  if (Array.isArray(payload.pois) && payload.pois.length > 0) {
    const system = payload.system as { id?: string; name?: string } | undefined;
    const systemLabel = system?.name || system?.id ? ` for ${system?.name ?? system?.id}` : "";
    return `system${systemLabel} with ${payload.pois.length} POIs`;
  }
  if (payload.poi && typeof payload.poi === "object") {
    const poi = payload.poi as { id?: string; name?: string; type?: string };
    return `poi ${poi.name ?? poi.id ?? ""}${poi.type ? ` (${poi.type})` : ""}`.trim();
  }
  if (payload.base && typeof payload.base === "object") {
    const base = payload.base as { id?: string; name?: string };
    return `base ${base.name ?? base.id ?? ""}`.trim();
  }
  if (payload.version) {
    return `version ${String(payload.version)}`;
  }
  return null;
}

function shutdown(): void {
  try {
    client.disconnect();
  } catch {
    // ignore
  }
  tui.destroy();
  process.exit(0);
}

tui.onExit(shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

client.on<WelcomePayload>("welcome", async (data) => {
  log(`Welcome: v${data.version} (tick ${data.tick_rate}s)`);
  if (data.motd) log(`MOTD: ${data.motd}`);
  memory.appendEvent("welcome", data);

  if (credentials) {
    log(`Auto-login as ${credentials.username}`);
    client.login(credentials.username, credentials.token);
  } else {
    await runRegistrationFlow();
  }
});

client.on<RegisteredPayload>("registered", async (data) => {
  memory.appendEvent("registered", data);
  registrationRetries = 0;
  failedRegistrationNames.length = 0;
  if (pendingRegistration) {
    await saveCredentials(pendingRegistration.username, data.token);
    log(`Registered. Saved credentials for ${pendingRegistration.username}`);
    pendingRegistration = null;
  } else {
    log("Registered but no pending registration found.");
  }
});

client.on<LoggedInPayload>("logged_in", (data) => {
  log(`Logged in as ${data.player.username} (${data.player.empire})`);
  memory.appendEvent("logged_in", data);
  worldSnapshot.system = data.system;
  worldSnapshot.poi = data.poi;
  client.getSystem();
  client.getPOI();
  if (data.player.docked_at_base) {
    client.getBase();
  }
  updateStatus();
  saveSnapshot();
  startActionLoop();
});

client.on<ErrorPayload>("error", (data) => {
  log(`Error [${data.code}] ${data.message}`);
  memory.appendEvent("error", data);
  if (data.code === "username_taken" && pendingRegistration) {
    if (pendingRegistration.username) {
      failedRegistrationNames.push(pendingRegistration.username);
    }
    if (registrationRetries < MAX_REGISTRATION_RETRIES) {
      registrationRetries += 1;
      log("Username taken. Requesting a new registration name...");
      pendingRegistration = null;
      runRegistrationFlow();
    } else {
      log("Username taken repeatedly. Falling back to random name.");
      const fallback = `molt-bot-${Math.floor(Math.random() * 10000)}`;
      pendingRegistration = { username: fallback, empire: "solarian" };
      client.register(fallback, "solarian");
    }
  }
});

client.on<StateUpdatePayload>("state_update", (data) => {
  memory.appendEvent("state_update", data);
  updateStatus();
  saveSnapshot();
  if (data.in_combat) {
    log(`IN COMBAT: Hull ${data.ship.hull}/${data.ship.max_hull} Shield ${data.ship.shield}/${data.ship.max_shield}`);
  }
});

client.on<ChatMessage>("chat_message", (data) => {
  log(`[${data.channel}] ${data.sender}: ${data.content}`);
  memory.appendEvent("chat_message", data);
});

client.on<ScanResultPayload>("scan_result", (data) => {
  log(`Scan result: ${safeJson(data)}`);
  memory.appendEvent("scan_result", data);
});

client.on("ok", (data: Record<string, unknown>) => {
  log(formatOkPayload(data));
  memory.appendEvent("ok", data);
  updateWorldSnapshotFromOk(data);
});

client.on("version_info", (data: Record<string, unknown>) => {
  log(`Version info: ${safeJson(data)}`);
  memory.appendEvent("version_info", data);
});

credentials = await loadCredentials();
await client.connect();
updateStatus();

function updateWorldSnapshotFromOk(data: Record<string, unknown>): void {
  if (data.system && typeof data.system === "object") {
    worldSnapshot.system = data.system as WorldSnapshot["system"];
  }
  if (Array.isArray(data.pois)) {
    worldSnapshot.pois = data.pois as WorldSnapshot["pois"];
  }
  if (data.poi && typeof data.poi === "object") {
    worldSnapshot.poi = data.poi as WorldSnapshot["poi"];
  }
  if (data.base && typeof data.base === "object") {
    worldSnapshot.base = data.base as WorldSnapshot["base"];
  }
}
