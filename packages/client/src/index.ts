import { parseArgs, printHelp, printInstances } from "./cli.ts";
import { GameDatabase, generateInstanceId, instanceExists } from "./db.ts";
import { GameClient } from "./game-client.ts";

async function main() {
	try {
		const parsed = parseArgs(Bun.argv.slice(2));

		if (parsed.command === "help") {
			printHelp();
			return;
		}

		if (parsed.command === "list-instances") {
			printInstances();
			return;
		}

		if (parsed.command === "update-hint") {
			if (!parsed.instanceId || !parsed.hint) {
				console.error("Error: update-hint requires --instance and --hint");
				process.exit(1);
			}

			if (!(await instanceExists(parsed.instanceId))) {
				console.error(`Error: Instance '${parsed.instanceId}' does not exist`);
				process.exit(1);
			}

			const db = new GameDatabase(parsed.instanceId);
			db.updateHint(parsed.hint);
			console.log(`Hint updated for instance '${parsed.instanceId}': ${parsed.hint}`);
			db.close();
			return;
		}

		if (parsed.command === "update-prompt") {
			if (!parsed.instanceId || !parsed.prompt || !parsed.username) {
				console.error("Error: update-prompt requires --instance, --username, and --prompt");
				process.exit(1);
			}

			if (!(await instanceExists(parsed.instanceId))) {
				console.error(`Error: Instance '${parsed.instanceId}' does not exist`);
				process.exit(1);
			}

			const db = new GameDatabase(parsed.instanceId);
			db.updateUsernamePrompt(parsed.username, parsed.prompt);
			console.log(
				`Prompt updated for username '${parsed.username}' in instance '${parsed.instanceId}': ${parsed.prompt}`,
			);
			db.close();
			return;
		}

		if (parsed.command === "start") {
			if (!parsed.config) {
				console.error("Error: Invalid configuration");
				process.exit(1);
			}

			if (!parsed.config.instanceId) {
				parsed.config.instanceId = generateInstanceId();
				console.log(`Generated instance ID: ${parsed.config.instanceId}`);
			}

			if (await instanceExists(parsed.config.instanceId)) {
				console.log(`Using existing instance: ${parsed.config.instanceId}`);
			} else {
				console.log(`Creating new instance: ${parsed.config.instanceId}`);
			}

			const db = new GameDatabase(parsed.config.instanceId);
			const client = new GameClient(db, parsed.config);

			process.on("SIGINT", () => {
				console.log("\nShutting down...");
				client.stop();
				process.exit(0);
			});

			process.on("SIGTERM", () => {
				client.stop();
				process.exit(0);
			});

			await client.start();
		}
	} catch (error) {
		console.error("Error:", error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

main();
