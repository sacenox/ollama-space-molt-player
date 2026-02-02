// Generate full prompts from database for analysis
// Usage: bun run scripts/generate-prompt-from-db.ts <db-path> [options]

import { Database } from "bun:sqlite";
import type { ClientState } from "../client/src/client";
import type { Snapshot } from "../src/memory";
import { type HistoryEntry, MemoryStore } from "../src/memory";
import { OllamaAgent } from "../src/ollama";
import {
	buildActionPrompt,
	buildLastActionResult,
	buildSummaryPrompt,
	type PromptContext,
	type WorldSnapshot,
} from "../src/prompt";
import type {
	AlignmentType,
	Credentials,
	PersonalityType,
	SpeechStyleType,
} from "../src/types";

// ============================================================================
// Types
// ============================================================================

interface CliArgs {
	dbPath: string;
	count: number;
	actionId: number | null;
	outputPath: string;
	verbose: boolean;
}

interface StoredAction {
	id: number;
	ts: string;
	tick: number;
	action: string;
	args: string | null;
	model_raw: string | null;
}

interface AnalysisResult {
	action: StoredAction;
	prompt: string;
	analysis: {
		missingInfo: string[];
		duplicates: DuplicateInfo[];
		bias: BiasInfo[];
		errorLeakage: ErrorInfo[];
		structure: StructureInfo;
	};
}

interface DuplicateInfo {
	text: string;
	count: number;
}

interface BiasInfo {
	pattern: string;
	matches: number;
	context: string;
}

interface ErrorInfo {
	pattern: string;
	matches: number;
	context: string;
}

interface StructureInfo {
	length: number;
	errors: string[];
	warnings: string[];
}

interface PromptComparison {
	tick1: number;
	tick2: number;
	lengthDiff: number;
	sectionsChanged: string[];
	similarity: number;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
		console.log(`
Usage: bun run scripts/generate-prompt-from-db.ts <db-path> [options]

Options:
  --count=N          Number of recent actions to analyze (default: 3)
  --output=PATH      Output file path (default: auto-generated)
  --action-id=ID     Analyze specific action by ID instead of recent
  --verbose          Include extra debug information

Examples:
  bun run scripts/generate-prompt-from-db.ts memory-test.sqlite
  bun run scripts/generate-prompt-from-db.ts memory-swarm-01.sqlite --count=5
  bun run scripts/generate-prompt-from-db.ts memory-test.sqlite --action-id=42
`);
		process.exit(0);
	}

	const dbPath = args[0];
	let count = 3;
	let actionId: number | null = null;
	let outputPath = "";
	let verbose = false;

	for (const arg of args.slice(1)) {
		if (arg.startsWith("--count=")) {
			count = Number.parseInt(arg.split("=")[1]);
		} else if (arg.startsWith("--action-id=")) {
			actionId = Number.parseInt(arg.split("=")[1]);
		} else if (arg.startsWith("--output=")) {
			outputPath = arg.split("=")[1];
		} else if (arg === "--verbose") {
			verbose = true;
		}
	}

	// Auto-generate output path if not provided
	if (!outputPath) {
		const dbBasename = dbPath.split("/").pop()?.replace(".sqlite", "") ?? "db";
		const timestamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.slice(0, -5);
		outputPath = `prompt-analysis-${dbBasename}-${timestamp}.md`;
	}

	return { dbPath, count, actionId, outputPath, verbose };
}

// ============================================================================
// Database Validation
// ============================================================================

function validateDatabase(dbPath: string): void {
	// Check if file exists
	const file = Bun.file(dbPath);
	if (!file.size) {
		console.error(`Error: Database file not found: ${dbPath}`);
		process.exit(1);
	}

	// Try to open it
	try {
		const db = new Database(dbPath, { readonly: true });

		// Check for required tables
		const tables = db
			.query("SELECT name FROM sqlite_master WHERE type='table'")
			.all() as { name: string }[];
		const tableNames = tables.map((t) => t.name);

		const requiredTables = [
			"actions",
			"events",
			"state_snapshots",
			"credentials",
			"llm_missions",
		];
		for (const table of requiredTables) {
			if (!tableNames.includes(table)) {
				console.error(`Error: Missing required table: ${table}`);
				db.close();
				process.exit(1);
			}
		}

		// Check for tick column in actions table (required after migration)
		const actionCols = db.query("PRAGMA table_info(actions)").all() as {
			name: string;
		}[];
		const hasTickCol = actionCols.some((col) => col.name === "tick");

		if (!hasTickCol) {
			console.error(
				"Error: Database schema is outdated. Missing 'tick' column in actions table.",
			);
			console.error(
				"Please run the bot once to trigger automatic migration, or generate new data.",
			);
			db.close();
			process.exit(1);
		}

		db.close();
	} catch (error) {
		console.error(
			`Error: Failed to validate database: ${(error as Error).message}`,
		);
		process.exit(1);
	}
}

// ============================================================================
// State Reconstruction
// ============================================================================

function getLatestSnapshot(db: Database, tick: number): Snapshot | null {
	const row = db
		.query(
			"SELECT tick, player, ship, system, poi, base, nearby FROM state_snapshots WHERE tick <= ? ORDER BY tick DESC LIMIT 1",
		)
		.get(tick) as
		| {
				tick: number;
				player: string;
				ship: string;
				system: string;
				poi: string;
				base: string;
				nearby: string;
		  }
		| undefined;

	if (!row) return null;

	return {
		tick: row.tick,
		player: JSON.parse(row.player),
		ship: JSON.parse(row.ship),
		system: JSON.parse(row.system),
		poi: JSON.parse(row.poi),
		base: JSON.parse(row.base),
		nearby: JSON.parse(row.nearby),
	};
}

function parseSnapshotToState(snapshot: Snapshot): ClientState {
	return {
		connected: true,
		authenticated: true,
		player: snapshot.player,
		ship: snapshot.ship,
		system: snapshot.system,
		poi: snapshot.poi,
		base: snapshot.base,
		nearby: snapshot.nearby,
		inCombat: false, // We don't track this in snapshots
		currentTick: snapshot.tick,
	};
}

async function reconstructState(
	db: Database,
	tick: number,
): Promise<ClientState | null> {
	const snapshot = getLatestSnapshot(db, tick);
	if (!snapshot) {
		console.warn(`Warning: No snapshot found for tick ${tick}`);
		return null;
	}

	if (snapshot.tick !== tick) {
		console.warn(
			`Warning: Using snapshot from tick ${snapshot.tick} for action at tick ${tick}`,
		);
	}

	return parseSnapshotToState(snapshot);
}

// ============================================================================
// History Reconstruction
// ============================================================================

function getRecentHistory(
	memory: MemoryStore,
	tick: number,
	limit: number,
): HistoryEntry[] {
	const db = new Database(memory["db"]["filename"], { readonly: true });

	// Get actions before this tick
	const actions = db
		.query(
			"SELECT ts, tick, action, args FROM actions WHERE tick < ? ORDER BY tick DESC LIMIT ?",
		)
		.all(tick, limit) as {
		ts: string;
		tick: number;
		action: string;
		args: string | null;
	}[];

	// Get events before this tick
	const events = db
		.query(
			"SELECT ts, tick, type, payload FROM events WHERE tick < ? ORDER BY tick DESC LIMIT ?",
		)
		.all(tick, limit) as {
		ts: string;
		tick: number;
		type: string;
		payload: string | null;
	}[];

	db.close();

	// Combine and sort
	const history: HistoryEntry[] = [
		...actions.map((a) => ({
			kind: "action" as const,
			ts: a.ts,
			tick: a.tick,
			action: a.action,
			args: a.args,
		})),
		...events.map((e) => ({
			kind: "event" as const,
			ts: e.ts,
			tick: e.tick,
			type: e.type,
			payload: e.payload,
		})),
	];

	history.sort((a, b) => {
		if (a.tick !== b.tick) return a.tick - b.tick;
		return new Date(a.ts).getTime() - new Date(b.ts).getTime();
	});

	return history.reverse(); // Most recent first
}

async function generateMemorySummary(
	history: HistoryEntry[],
	ollama: OllamaAgent,
): Promise<string> {
	if (history.length === 0) {
		return "(no recent activity)";
	}

	try {
		const summaryPrompt = buildSummaryPrompt(history, 0);
		const summary = await ollama.generateText(summaryPrompt);
		return summary || "(summary unavailable)";
	} catch (error) {
		console.warn(
			`Warning: Failed to generate memory summary: ${(error as Error).message}`,
		);
		return "(summary generation failed)";
	}
}

// ============================================================================
// Prompt Context Building
// ============================================================================

function detectRepetition(
	db: Database,
	tick: number,
): { action: string; count: number } | null {
	const recentActions = db
		.query(
			"SELECT action, args FROM actions WHERE tick < ? ORDER BY tick DESC LIMIT 5",
		)
		.all(tick) as { action: string; args: string | null }[];

	if (recentActions.length < 3) return null;

	// Check if last 3+ actions are the same
	const firstAction = recentActions[0];
	let count = 1;

	for (let i = 1; i < recentActions.length; i++) {
		if (
			recentActions[i].action === firstAction.action &&
			recentActions[i].args === firstAction.args
		) {
			count++;
		} else {
			break;
		}
	}

	if (count >= 3) {
		return { action: firstAction.action, count };
	}

	return null;
}

function extractThinking(modelRaw: string | null): string | null {
	if (!modelRaw) return null;

	// Look for thinking tags in the raw response
	const thinkingMatch = modelRaw.match(/<thinking>([\s\S]*?)<\/thinking>/i);
	if (thinkingMatch) {
		return thinkingMatch[1].trim();
	}

	return null;
}

async function buildPromptContext(
	memory: MemoryStore,
	db: Database,
	state: ClientState,
	action: StoredAction,
	creds: Credentials,
	ollama: OllamaAgent,
): Promise<PromptContext> {
	const tick = action.tick;

	// Get recent history
	const recentHistory = getRecentHistory(memory, tick, 20);

	// Generate memory summary
	const memorySummary = await generateMemorySummary(recentHistory, ollama);

	// Get current mission
	const missionRow = db
		.query(
			"SELECT mission FROM llm_missions WHERE id <= (SELECT id FROM actions WHERE tick = ? LIMIT 1) ORDER BY id DESC LIMIT 1",
		)
		.get(tick) as { mission: string } | undefined;
	const currentMission = missionRow?.mission || null;

	// Get last action result
	const lastActionResult = buildLastActionResult(memory, tick);

	// Detect repetition
	const repetitionWarning = detectRepetition(db, tick);

	// Extract thinking from previous action
	const prevAction = db
		.query(
			"SELECT model_raw FROM actions WHERE tick < ? ORDER BY tick DESC LIMIT 1",
		)
		.get(tick) as { model_raw: string | null } | undefined;
	const lastThinking = extractThinking(prevAction?.model_raw || null);

	// Build world snapshot
	const worldSnapshot: WorldSnapshot = {
		system: state.system,
		pois: [], // Not always available in snapshots
		poi: state.poi,
		base: state.base,
	};

	return {
		state,
		worldSnapshot,
		recentHistory,
		memorySummary,
		currentMission,
		currentTick: tick,
		memory,
		empire: creds.personality === "merchant" ? "solarian" : "nebula", // Fallback - we don't store empire
		alignment: creds.alignment,
		personality: creds.personality,
		speechStyle: creds.speech_style,
		lastActionResult,
		repetitionWarning,
		lastThinking,
		lastForumThreadId: null,
		lastForumPostTitle: null,
		lastForumPostCategory: null,
		forumFollowUpStatus: null,
	};
}

// ============================================================================
// Analysis Functions
// ============================================================================

function checkMissingInfo(prompt: string): string[] {
	const errors: string[] = [];
	const requiredSections = [
		"PLAYER STATE:",
		"WORLD INFORMATION:",
		"CURRENT MISSION:",
		"EMPIRE:",
		"ALIGNMENT:",
		"PERSONALITY:",
		"SPEECH STYLE:",
		"ACTION SCHEMA",
		"LAST ACTION RESULT:",
		"MEMORY SUMMARY:",
		"SOCIAL:",
	];

	for (const section of requiredSections) {
		if (!prompt.includes(section)) {
			errors.push(`Missing required section: ${section}`);
		}
	}

	return errors;
}

function checkDuplicates(prompt: string): DuplicateInfo[] {
	const lines = prompt.split("\n");
	const lineCounts = new Map<string, number>();

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.length > 30) {
			lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1);
		}
	}

	const duplicates = Array.from(lineCounts.entries())
		.filter(([_, count]) => count > 2)
		.sort((a, b) => b[1] - a[1])
		.map(([text, count]) => ({ text, count }));

	return duplicates;
}

function checkBias(prompt: string): BiasInfo[] {
	const biasPatterns = [
		/you must always/gi,
		/you should always/gi,
		/never do/gi,
		/always prefer/gi,
		/it is best to/gi,
		/recommended action:/gi,
	];

	const bias: BiasInfo[] = [];

	// Split at personality/alignment sections to exclude guidance
	const parts = prompt.split(/(YOUR PERSONALITY:|YOUR ALIGNMENT:)/);
	const nonGuidanceSection = parts[0] || "";

	for (const pattern of biasPatterns) {
		const matches = [...nonGuidanceSection.matchAll(pattern)];
		if (matches.length > 0) {
			const firstMatch = matches[0];
			const index = firstMatch.index || 0;
			const contextStart = Math.max(0, index - 50);
			const contextEnd = Math.min(
				nonGuidanceSection.length,
				index + firstMatch[0].length + 50,
			);
			const context = nonGuidanceSection.slice(contextStart, contextEnd);

			bias.push({
				pattern: pattern.source,
				matches: matches.length,
				context: `...${context}...`,
			});
		}
	}

	return bias;
}

function checkErrorLeakage(prompt: string): ErrorInfo[] {
	const errorPatterns = [
		/Error:/gi,
		/TypeError/gi,
		/undefined is not/gi,
		/stack trace/gi,
		/\bat .+\.ts:\d+:\d+/gi,
		/Exception/gi,
		/ECONNREFUSED/gi,
		/ETIMEDOUT/gi,
		/JSON\.parse/gi,
	];

	const errors: ErrorInfo[] = [];

	for (const pattern of errorPatterns) {
		const matches = [...prompt.matchAll(pattern)];
		if (matches.length > 0) {
			const firstMatch = matches[0];
			const index = firstMatch.index || 0;
			const contextStart = Math.max(0, index - 50);
			const contextEnd = Math.min(
				prompt.length,
				index + firstMatch[0].length + 50,
			);
			const context = prompt.slice(contextStart, contextEnd);

			errors.push({
				pattern: pattern.source,
				matches: matches.length,
				context: `...${context}...`,
			});
		}
	}

	return errors;
}

function checkStructure(prompt: string): StructureInfo {
	const errors: string[] = [];
	const warnings: string[] = [];
	const length = prompt.length;

	// Length checks
	if (length < 2000) {
		errors.push(`Prompt too short: ${length} chars (expected >2000)`);
	} else if (length > 20000) {
		errors.push(`Prompt too long: ${length} chars (expected <20000)`);
	} else if (length > 15000) {
		warnings.push(`Prompt on longer side: ${length} chars`);
	}

	// Section ordering
	const expectedOrder = [
		"You are playing",
		"GAME INFORMATION:",
		"CURRENT MISSION:",
		"EMPIRE:",
		"ALIGNMENT:",
		"PERSONALITY:",
		"PLAYER STATE:",
		"WORLD INFORMATION:",
		"MEMORY SUMMARY:",
		"LAST ACTION RESULT:",
		"SOCIAL:",
		"ACTION SCHEMA",
		"HOW TO PLAY:",
	];

	let lastIndex = -1;
	for (const section of expectedOrder) {
		const index = prompt.indexOf(section);
		if (index !== -1 && index < lastIndex) {
			errors.push(`Section out of order: "${section}"`);
		}
		if (index !== -1) lastIndex = index;
	}

	// Check for section headers
	const sectionHeaders = prompt.match(/^[A-Z][A-Z\s:]+$/gm) || [];
	if (sectionHeaders.length < 10) {
		warnings.push(
			`Few section headers: ${sectionHeaders.length} (expected 10+)`,
		);
	}

	return { length, errors, warnings };
}

function analyzePrompt(prompt: string): AnalysisResult["analysis"] {
	return {
		missingInfo: checkMissingInfo(prompt),
		duplicates: checkDuplicates(prompt),
		bias: checkBias(prompt),
		errorLeakage: checkErrorLeakage(prompt),
		structure: checkStructure(prompt),
	};
}

// ============================================================================
// Prompt Comparison
// ============================================================================

function calculateSimilarity(p1: string, p2: string): number {
	// Simple Jaccard similarity on words
	const words1 = new Set(p1.toLowerCase().split(/\s+/));
	const words2 = new Set(p2.toLowerCase().split(/\s+/));

	const intersection = new Set([...words1].filter((w) => words2.has(w)));
	const union = new Set([...words1, ...words2]);

	return union.size > 0 ? intersection.size / union.size : 0;
}

function comparePrompts(
	result1: AnalysisResult,
	result2: AnalysisResult,
): PromptComparison {
	const p1 = result1.prompt;
	const p2 = result2.prompt;

	const lengthDiff = p2.length - p1.length;
	const similarity = calculateSimilarity(p1, p2);

	// Detect which sections changed
	const sections = [
		"PLAYER STATE:",
		"WORLD INFORMATION:",
		"MEMORY SUMMARY:",
		"LAST ACTION RESULT:",
		"CURRENT MISSION:",
	];

	const sectionsChanged: string[] = [];
	for (const section of sections) {
		const idx1 = p1.indexOf(section);
		const idx2 = p2.indexOf(section);

		if (idx1 === -1 && idx2 !== -1) {
			sectionsChanged.push(`${section} (added)`);
		} else if (idx1 !== -1 && idx2 === -1) {
			sectionsChanged.push(`${section} (removed)`);
		} else if (idx1 !== -1 && idx2 !== -1) {
			// Extract section content and compare
			const nextIdx1 = p1.indexOf("\n\n", idx1 + section.length) || p1.length;
			const nextIdx2 = p2.indexOf("\n\n", idx2 + section.length) || p2.length;
			const content1 = p1.slice(idx1, nextIdx1);
			const content2 = p2.slice(idx2, nextIdx2);

			if (content1 !== content2) {
				sectionsChanged.push(`${section} (modified)`);
			}
		}
	}

	return {
		tick1: result1.action.tick,
		tick2: result2.action.tick,
		lengthDiff,
		sectionsChanged,
		similarity,
	};
}

// ============================================================================
// Report Generation
// ============================================================================

function formatAnalysisSection(
	result: AnalysisResult,
	verbose: boolean,
): string {
	const { action, prompt, analysis } = result;
	let output = "";

	output += "\n" + "-".repeat(80) + "\n";
	output += `ACTION #${action.id} - ${action.action} (T${action.tick}, ${action.ts})\n`;
	output += "-".repeat(80) + "\n\n";

	if (action.args) {
		output += `**Args**: \`${action.args}\`\n\n`;
	}

	// Count errors
	const totalErrors =
		analysis.missingInfo.length +
		(analysis.duplicates.length > 0 ? 1 : 0) +
		(analysis.bias.length > 0 ? 1 : 0) +
		(analysis.errorLeakage.length > 0 ? 1 : 0) +
		analysis.structure.errors.length;

	output += `### Analysis Summary\n\n`;
	output += `**Total Errors**: ${totalErrors}\n`;
	output += `**Total Warnings**: ${analysis.structure.warnings.length}\n`;
	output += `**Prompt Length**: ${analysis.structure.length} chars\n\n`;

	// Missing Info
	output += `### ❌ Missing Information\n\n`;
	if (analysis.missingInfo.length === 0) {
		output += `✅ All required sections present\n\n`;
	} else {
		for (const error of analysis.missingInfo) {
			output += `- ❌ ${error}\n`;
		}
		output += "\n";
	}

	// Duplicates
	output += `### 📋 Duplicate Information\n\n`;
	if (analysis.duplicates.length === 0) {
		output += `✅ No significant duplicates detected\n\n`;
	} else {
		output += `❌ Found ${analysis.duplicates.length} lines repeated >2 times:\n\n`;
		for (const dup of analysis.duplicates.slice(0, 5)) {
			const preview =
				dup.text.length > 80 ? `${dup.text.slice(0, 77)}...` : dup.text;
			output += `- \`${preview}\` (${dup.count}x)\n`;
		}
		output += "\n";
	}

	// Bias
	output += `### ⚖️ Neutral Bias Check\n\n`;
	if (analysis.bias.length === 0) {
		output += `✅ No bias patterns detected\n\n`;
	} else {
		for (const b of analysis.bias) {
			output += `- ❌ Pattern \`${b.pattern}\` found ${b.matches}x\n`;
			if (verbose) {
				output += `  Context: ${b.context}\n`;
			}
		}
		output += "\n";
	}

	// Error Leakage
	output += `### 🔴 System Error Leakage\n\n`;
	if (analysis.errorLeakage.length === 0) {
		output += `✅ No error leakage detected\n\n`;
	} else {
		for (const err of analysis.errorLeakage) {
			output += `- ❌ Pattern \`${err.pattern}\` found ${err.matches}x\n`;
			if (verbose) {
				output += `  Context: ${err.context}\n`;
			}
		}
		output += "\n";
	}

	// Structure
	output += `### 📐 Structure Check\n\n`;
	if (
		analysis.structure.errors.length === 0 &&
		analysis.structure.warnings.length === 0
	) {
		output += `✅ Structure is good\n\n`;
	} else {
		for (const error of analysis.structure.errors) {
			output += `- ❌ ${error}\n`;
		}
		for (const warning of analysis.structure.warnings) {
			output += `- ⚠️ ${warning}\n`;
		}
		output += "\n";
	}

	// Full prompt
	output += `### Full Prompt\n\n`;
	output += "```\n";
	output += prompt;
	output += "\n```\n\n";

	// Model response
	if (action.model_raw) {
		output += `### Model Response\n\n`;
		output += "```json\n";
		output += action.model_raw.slice(0, 500);
		if (action.model_raw.length > 500) {
			output += "\n... (truncated)";
		}
		output += "\n```\n\n";
	}

	return output;
}

function formatComparisonSection(comparisons: PromptComparison[]): string {
	if (comparisons.length === 0) return "";

	let output = "\n" + "=".repeat(80) + "\n";
	output += "## Prompt Evolution Analysis\n";
	output += "=".repeat(80) + "\n\n";

	for (const comp of comparisons) {
		output += `### T${comp.tick1} → T${comp.tick2}\n\n`;
		output += `- **Length change**: ${comp.lengthDiff > 0 ? "+" : ""}${comp.lengthDiff} chars (${((comp.lengthDiff / (comp.similarity * 10000)) * 100).toFixed(1)}%)\n`;
		output += `- **Similarity**: ${(comp.similarity * 100).toFixed(1)}%\n`;

		if (comp.sectionsChanged.length > 0) {
			output += `- **Sections changed**:\n`;
			for (const section of comp.sectionsChanged) {
				output += `  - ${section}\n`;
			}
		} else {
			output += `- **Sections changed**: None (stable)\n`;
		}

		output += "\n";
	}

	return output;
}

function generateMarkdownReport(
	results: AnalysisResult[],
	comparisons: PromptComparison[],
	creds: Credentials,
	dbPath: string,
	verbose: boolean,
): string {
	let report = "";

	// Header
	report += "# Prompt Analysis Report\n\n";
	report += `**Database**: ${dbPath}\n`;
	report += `**Character**: ${creds.username}\n`;
	report += `**Personality**: ${creds.personality}\n`;
	report += `**Alignment**: ${creds.alignment}\n`;
	report += `**Speech Style**: ${creds.speech_style}\n`;
	report += `**Generated**: ${new Date().toISOString()}\n`;
	report += `**Actions Analyzed**: ${results.length}\n\n`;

	report += "---\n\n";

	// Summary
	report += "## Summary\n\n";

	let totalErrors = 0;
	let totalWarnings = 0;

	for (const result of results) {
		totalErrors +=
			result.analysis.missingInfo.length +
			(result.analysis.duplicates.length > 0 ? 1 : 0) +
			(result.analysis.bias.length > 0 ? 1 : 0) +
			(result.analysis.errorLeakage.length > 0 ? 1 : 0) +
			result.analysis.structure.errors.length;

		totalWarnings += result.analysis.structure.warnings.length;
	}

	report += `**Total Errors**: ${totalErrors}\n`;
	report += `**Total Warnings**: ${totalWarnings}\n\n`;

	// Calculate averages
	const avgLength =
		results.reduce((sum, r) => sum + r.analysis.structure.length, 0) /
		results.length;
	const minLength = Math.min(
		...results.map((r) => r.analysis.structure.length),
	);
	const maxLength = Math.max(
		...results.map((r) => r.analysis.structure.length),
	);

	report += `**Prompt Length**: avg ${Math.round(avgLength)} chars (min ${minLength}, max ${maxLength})\n\n`;

	if (comparisons.length > 0) {
		const avgSimilarity =
			comparisons.reduce((sum, c) => sum + c.similarity, 0) /
			comparisons.length;
		report += `**Prompt Stability**: ${(avgSimilarity * 100).toFixed(1)}% similarity between consecutive prompts\n\n`;
	}

	report += "---\n\n";

	// Individual analysis
	report += "## Detailed Analysis\n\n";

	for (const result of results) {
		report += formatAnalysisSection(result, verbose);
	}

	// Evolution analysis
	report += formatComparisonSection(comparisons);

	// Recommendations
	report += "---\n\n";
	report += "## Recommendations\n\n";

	if (totalErrors === 0) {
		report += "✅ No critical issues found. Prompts are well-structured.\n\n";
	} else {
		report += "### Critical Issues\n\n";

		// Check for common issues across all results
		const missingInfoCount = results.filter(
			(r) => r.analysis.missingInfo.length > 0,
		).length;
		const duplicateCount = results.filter(
			(r) => r.analysis.duplicates.length > 0,
		).length;
		const biasCount = results.filter((r) => r.analysis.bias.length > 0).length;
		const errorLeakageCount = results.filter(
			(r) => r.analysis.errorLeakage.length > 0,
		).length;

		if (missingInfoCount > 0) {
			report += `1. **Missing Information**: ${missingInfoCount}/${results.length} prompts missing required sections\n`;
		}
		if (duplicateCount > 0) {
			report += `2. **Duplicate Content**: ${duplicateCount}/${results.length} prompts contain duplicate lines\n`;
		}
		if (biasCount > 0) {
			report += `3. **Bias Detected**: ${biasCount}/${results.length} prompts contain biased language\n`;
		}
		if (errorLeakageCount > 0) {
			report += `4. **Error Leakage**: ${errorLeakageCount}/${results.length} prompts contain system errors\n`;
		}

		report += "\n";
	}

	return report;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
	console.log("=".repeat(80));
	console.log("PROMPT ANALYSIS - GENERATE FROM DATABASE");
	console.log("=".repeat(80));

	const args = parseArgs();

	console.log(`\nDatabase: ${args.dbPath}`);
	console.log(`Output: ${args.outputPath}`);
	if (args.actionId !== null) {
		console.log(`Analyzing action ID: ${args.actionId}`);
	} else {
		console.log(`Analyzing last ${args.count} actions`);
	}
	console.log("");

	// Validate database
	validateDatabase(args.dbPath);

	// Load database and memory
	const memory = new MemoryStore(args.dbPath);
	const db = new Database(args.dbPath, { readonly: true });

	// Get credentials
	const creds = memory.getCredentials();
	if (!creds) {
		console.error("Error: No credentials found in database");
		db.close();
		process.exit(1);
	}

	console.log(`Character: ${creds.username}`);
	console.log(
		`Personality: ${creds.personality} / Alignment: ${creds.alignment} / Speech: ${creds.speech_style}`,
	);

	// Get total action count
	const countRow = db.query("SELECT COUNT(*) as cnt FROM actions").get() as {
		cnt: number;
	};
	console.log(`Total actions in database: ${countRow.cnt}\n`);

	// Create Ollama client for summary generation
	const ollama = new OllamaAgent(
		process.env.OLLAMA_URL ?? "http://localhost:11434",
		process.env.OLLAMA_MODEL ?? "qwen3:8b",
		60000,
		0.1,
		false,
	);

	// Determine which actions to analyze
	let actionsToAnalyze: StoredAction[] = [];

	if (args.actionId !== null) {
		const action = db
			.query(
				"SELECT id, ts, tick, action, args, model_raw FROM actions WHERE id = ?",
			)
			.get(args.actionId) as StoredAction | undefined;

		if (!action) {
			console.error(`Error: Action ID ${args.actionId} not found`);
			db.close();
			process.exit(1);
		}

		actionsToAnalyze = [action];
	} else {
		actionsToAnalyze = db
			.query(
				"SELECT id, ts, tick, action, args, model_raw FROM actions ORDER BY id DESC LIMIT ?",
			)
			.all(args.count) as StoredAction[];

		actionsToAnalyze.reverse(); // Oldest first for chronological order
	}

	console.log(`Analyzing ${actionsToAnalyze.length} action(s)...\n`);

	// Analyze each action
	const results: AnalysisResult[] = [];

	for (let i = 0; i < actionsToAnalyze.length; i++) {
		const action = actionsToAnalyze[i];
		console.log(
			`[${i + 1}/${actionsToAnalyze.length}] Processing action #${action.id} (${action.action} at T${action.tick})...`,
		);

		// Reconstruct state
		const state = await reconstructState(db, action.tick);
		if (!state) {
			console.warn(`  ⚠️ Skipping - no state snapshot available`);
			continue;
		}

		// Build context
		const context = await buildPromptContext(
			memory,
			db,
			state,
			action,
			creds,
			ollama,
		);

		// Generate prompt
		const prompt = buildActionPrompt(context);

		// Analyze
		const analysis = analyzePrompt(prompt);

		results.push({ action, prompt, analysis });

		console.log(`  ✅ Complete (${prompt.length} chars)`);
	}

	console.log("");

	// Compare prompts for evolution
	const comparisons: PromptComparison[] = [];
	for (let i = 0; i < results.length - 1; i++) {
		comparisons.push(comparePrompts(results[i], results[i + 1]));
	}

	// Generate report
	console.log("Generating report...");
	const report = generateMarkdownReport(
		results,
		comparisons,
		creds,
		args.dbPath,
		args.verbose,
	);

	// Save to file
	await Bun.write(args.outputPath, report);

	console.log(`\n${"=".repeat(80)}`);
	console.log(`✅ Analysis complete!`);
	console.log(`📄 Report saved to: ${args.outputPath}`);
	console.log(`${"=".repeat(80)}\n`);

	db.close();
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
