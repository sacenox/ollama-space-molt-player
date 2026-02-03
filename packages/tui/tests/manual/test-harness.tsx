/**
 * Manual test harness for rendering individual UI components
 * Allows visual inspection and screenshot verification
 */

import React from "react";
import { render, useInput } from "ink";
import { Box, Text } from "ink";

interface TestCase {
	name: string;
	component: React.ReactNode;
	description?: string;
}

interface TestHarnessProps {
	tests: TestCase[];
	title: string;
}

/**
 * Renders a test case with frame and metadata
 */
export function TestHarness({ tests, title }: TestHarnessProps) {
	const [currentIndex, setCurrentIndex] = React.useState(0);
	const currentTest = tests[currentIndex];

	useInput((input, key) => {
		if (key.leftArrow) {
			setCurrentIndex((prev) => Math.max(0, prev - 1));
		}
		if (key.rightArrow) {
			setCurrentIndex((prev) => Math.min(tests.length - 1, prev + 1));
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
				<Text bold color="cyan">
					{title}
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>
					Test {currentIndex + 1} of {tests.length}: {currentTest.name}
				</Text>
			</Box>

			{currentTest.description && (
				<Box marginBottom={1}>
					<Text color="gray">{currentTest.description}</Text>
				</Box>
			)}

			<Box borderStyle="single" borderColor="blue" padding={1}>
				{currentTest.component}
			</Box>

			<Box marginTop={1}>
				<Text dimColor>
					Press Ctrl+C to exit | Navigate: {currentIndex > 0 ? "← prev" : ""}{" "}
					{currentIndex < tests.length - 1 ? "→ next" : ""}
				</Text>
			</Box>
		</Box>
	);
}

/**
 * Run a test suite
 */
export function runTests(title: string, tests: TestCase[]) {
	const { unmount } = render(<TestHarness tests={tests} title={title} />);

	// Handle cleanup
	process.on("SIGINT", () => {
		unmount();
		process.exit(0);
	});
}

/**
 * Utility to create test data
 */
export function createMockData() {
	return {
		gameState: {
			currentTick: 1337,
			loopState: "processing_tick" as const,
			playerName: "CaptainTest",
			playerId: "test-001",
			location: "Alpha Centauri - Station Prime",
			shipName: "SS TestRunner",
			shipHealth: 85,
			shipFuel: 42,
			credits: 10500,
			cargo: [
				{ name: "Iron Ore", quantity: 50 },
				{ name: "Fuel Cells", quantity: 10 },
				{ name: "Medical Supplies", quantity: 5 },
			],
		},
		recentActions: [
			{
				tick: 1336,
				command: "travel sector-7",
				timestamp: "2026-02-03T10:30:00Z",
			},
			{
				tick: 1335,
				command: "scan nearby",
				timestamp: "2026-02-03T10:29:50Z",
			},
		],
		recentResponses: [
			{
				tick: 1336,
				message: "Travel initiated. ETA: 2 ticks",
				type: "success" as const,
				timestamp: "2026-02-03T10:30:01Z",
			},
			{
				tick: 1335,
				message: "Scan complete. 3 ships detected",
				type: "info" as const,
				timestamp: "2026-02-03T10:29:51Z",
			},
		],
		chatMessages: [
			{
				tick: 1336,
				channel: "local" as const,
				sender: "Trader_01",
				message: "Anyone selling fuel?",
				timestamp: "2026-02-03T10:30:00Z",
			},
			{
				tick: 1335,
				channel: "system" as const,
				sender: "SERVER",
				message: "Player CaptainTest entered the sector",
				timestamp: "2026-02-03T10:29:50Z",
			},
		],
		forumPosts: [
			{
				id: "post-1",
				author: "AdminBot",
				title: "Welcome to SpaceMolt!",
				preview: "Read this guide before starting your journey...",
				replies: 42,
				timestamp: "2026-02-01T12:00:00Z",
			},
			{
				id: "post-2",
				author: "Veteran_Trader",
				title: "Best trade routes for beginners",
				preview: "I've compiled a list of profitable routes...",
				replies: 15,
				timestamp: "2026-02-02T08:30:00Z",
			},
		],
		serverMessages: [
			{
				tick: 1337,
				category: "combat",
				message: "Enemy ship detected in range",
				timestamp: "2026-02-03T10:30:10Z",
			},
			{
				tick: 1336,
				category: "trade",
				message: "Market prices updated",
				timestamp: "2026-02-03T10:30:00Z",
			},
		],
	};
}
