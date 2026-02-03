#!/usr/bin/env bun
/**
 * Individual component preview tests
 * Tests each component in isolation at different sizes
 */

import React from "react";
import { Box, Text } from "ink";
import { runTests, createMockData } from "./test-harness.tsx";
import { colors, boxChars, ascii } from "../../src/theme.ts";

/**
 * Header Component Preview
 */
function HeaderPreview({
	tick,
	loopState,
	width,
}: {
	tick: number;
	loopState: string;
	width: number;
}) {
	const statusColor =
		loopState === "error" ? colors.error : loopState === "idle" ? colors.inactive : colors.active;

	return (
		<Box borderStyle="double" borderColor={colors.primary} width={width} padding={1}>
			<Box flexDirection="row" justifyContent="space-between" width="100%">
				<Text bold color={colors.primary}>
					{ascii.diamond} SPACEMOLT TERMINAL
				</Text>
				<Text>
					<Text color={colors.textDim}>TICK:</Text>{" "}
					<Text bold color={colors.accent}>
						{tick}
					</Text>
				</Text>
				<Text>
					<Text color={colors.textDim}>STATUS:</Text>{" "}
					<Text bold color={statusColor}>
						{loopState.toUpperCase()}
					</Text>
				</Text>
			</Box>
		</Box>
	);
}

/**
 * Player Actions Panel Preview
 */
function PlayerActionsPanelPreview({ width, height }: { width: number; height: number }) {
	return (
		<Box
			borderStyle="single"
			borderColor={colors.border}
			width={width}
			height={height}
			flexDirection="column"
		>
			<Box padding={1} flexDirection="column">
				<Text bold color={colors.accent}>
					{ascii.diamond} PLAYER ACTIONS & RESPONSES
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text wrap="truncate-end">
						<Text color={colors.textDim}>T:1336 {ascii.arrow}</Text>{" "}
						<Text color={colors.info}>travel sector-7</Text>
					</Text>
					<Text wrap="truncate-end">
						<Text color={colors.success}>{ascii.bullet}</Text> Travel initiated. ETA: 2 ticks
					</Text>
				</Box>
				<Box marginTop={1} flexDirection="column">
					<Text>
						<Text color={colors.textDim}>T:1335 {ascii.arrow}</Text>{" "}
						<Text color={colors.info}>scan nearby</Text>
					</Text>
					<Text>
						<Text color={colors.info}>{ascii.bullet}</Text> Scan complete. 3 ships detected
					</Text>
				</Box>
				<Box marginTop={1} flexDirection="column">
					<Text>
						<Text color={colors.textDim}>T:1334 {ascii.arrow}</Text>{" "}
						<Text color={colors.info}>mine asteroid</Text>
					</Text>
					<Text>
						<Text color={colors.error}>{ascii.bullet}</Text> Error: No mining equipment detected
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

/**
 * Social Panel Preview
 */
function SocialPanelPreview({ width, height }: { width: number; height: number }) {
	return (
		<Box
			borderStyle="single"
			borderColor={colors.border}
			width={width}
			height={height}
			flexDirection="column"
		>
			<Box padding={1} flexDirection="column">
				<Text bold color={colors.accent}>
					{ascii.diamond} SOCIAL [CHAT | FORUM]
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text color={colors.textDim}>{boxChars.horizontal.repeat(5)} CHAT</Text>
					<Text>
						<Text color={colors.warning}>local</Text> | <Text color={colors.info}>Trader_01</Text>:
						Anyone selling fuel?
					</Text>
					<Text>
						<Text color={colors.info}>system</Text> | <Text dimColor>SERVER</Text>: Player
						CaptainTest entered
					</Text>
				</Box>
				<Box marginTop={1} flexDirection="column">
					<Text color={colors.textDim}>{boxChars.horizontal.repeat(5)} FORUM</Text>
					<Text>
						{ascii.star} <Text color={colors.highlight}>Welcome to SpaceMolt!</Text>{" "}
						<Text dimColor>(42 replies)</Text>
					</Text>
					<Text>
						{ascii.star} <Text color={colors.highlight}>Best trade routes</Text>{" "}
						<Text dimColor>(15 replies)</Text>
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

/**
 * Ship Status Sidebar Preview
 */
function ShipStatusPreview({ width, height }: { width: number; height: number }) {
	return (
		<Box
			borderStyle="single"
			borderColor={colors.border}
			width={width}
			height={height}
			flexDirection="column"
		>
			<Box padding={1} flexDirection="column">
				<Text bold color={colors.info}>
					{ascii.star} SHIP STATUS
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text>
						<Text color={colors.textDim}>Name:</Text> SS TestRunner
					</Text>
					<Text>
						<Text color={colors.textDim}>Health:</Text> <Text color={colors.success}>85%</Text>{" "}
						{ascii.square.repeat(8)}
					</Text>
					<Text>
						<Text color={colors.textDim}>Fuel:</Text> <Text color={colors.warning}>42%</Text>{" "}
						{ascii.square.repeat(4)}
					</Text>
					<Text>
						<Text color={colors.textDim}>Credits:</Text> 10,500 {ascii.diamond}
					</Text>
				</Box>
				<Box marginTop={1} flexDirection="column">
					<Text color={colors.textDim}>{boxChars.horizontal.repeat(10)}</Text>
					<Text>
						<Text color={colors.textDim}>Location:</Text>
					</Text>
					<Text dimColor>Alpha Centauri</Text>
					<Text dimColor>Station Prime</Text>
				</Box>
			</Box>
		</Box>
	);
}

/**
 * Server Messages Sidebar Preview
 */
function ServerMessagesPreview({ width, height }: { width: number; height: number }) {
	return (
		<Box
			borderStyle="single"
			borderColor={colors.border}
			width={width}
			height={height}
			flexDirection="column"
		>
			<Box padding={1} flexDirection="column">
				<Text bold color={colors.warning}>
					{ascii.triangle} SERVER MESSAGES
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text>
						<Text color={colors.error}>combat</Text> {ascii.bullet} Enemy ship detected
					</Text>
					<Text>
						<Text color={colors.info}>trade</Text> {ascii.bullet} Market prices updated
					</Text>
					<Text>
						<Text color={colors.success}>system</Text> {ascii.bullet} Jump gate available
					</Text>
					<Text>
						<Text color={colors.warning}>alert</Text> {ascii.bullet} Low fuel warning
					</Text>
				</Box>
			</Box>
		</Box>
	);
}

// Run component preview tests
runTests("Component Previews", [
	{
		name: "Header - Standard",
		description: "Header at typical width showing active state",
		component: <HeaderPreview tick={1337} loopState="processing_tick" width={120} />,
	},
	{
		name: "Header - Compact",
		description: "Header at minimum width",
		component: <HeaderPreview tick={42} loopState="idle" width={80} />,
	},
	{
		name: "Header - Error State",
		description: "Header showing error state",
		component: <HeaderPreview tick={999} loopState="error" width={100} />,
	},
	{
		name: "Player Actions Panel - Standard",
		description: "Player actions with success, info, and error responses",
		component: <PlayerActionsPanelPreview width={60} height={15} />,
	},
	{
		name: "Social Panel - Standard",
		description: "Chat and forum messages combined",
		component: <SocialPanelPreview width={60} height={15} />,
	},
	{
		name: "Ship Status Sidebar - Standard",
		description: "Ship health, fuel, credits, and location",
		component: <ShipStatusPreview width={30} height={15} />,
	},
	{
		name: "Server Messages Sidebar - Standard",
		description: "Categorized server messages",
		component: <ServerMessagesPreview width={30} height={12} />,
	},
]);
