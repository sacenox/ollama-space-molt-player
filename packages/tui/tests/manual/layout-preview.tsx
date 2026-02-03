#!/usr/bin/env bun

import React from "react";
import { Box, Text } from "ink";
import { runTests, createMockData } from "./test-harness.tsx";
import { colors, boxChars, ascii, layout } from "../../src/theme.ts";

interface LayoutPreviewProps {
	width: number;
	height: number;
}

function LayoutPreview({ width, height }: LayoutPreviewProps) {
	const headerHeight = layout.headerHeight;
	const contentHeight = height - headerHeight - 2;
	const sidebarWidth = layout.sidebarWidth;
	const mainWidth = width - sidebarWidth - 4;

	return (
		<Box flexDirection="column" width={width} height={height}>
			<Box borderStyle="double" borderColor={colors.primary} height={headerHeight} width={width}>
				<Text bold color={colors.primary}>
					{" "}
					SPACEMOLT TERMINAL {ascii.separator} TICK: 1337 {ascii.separator} STATUS: ACTIVE{" "}
				</Text>
			</Box>

			<Box flexDirection="row" height={contentHeight}>
				<Box flexDirection="column" width={mainWidth}>
					<Box
						borderStyle="single"
						borderColor={colors.border}
						height={Math.floor(contentHeight / 2)}
						flexGrow={1}
					>
						<Box flexDirection="column" padding={1}>
							<Text bold color={colors.accent}>
								{ascii.diamond} PLAYER ACTIONS & RESPONSES
							</Text>
							<Text dimColor>{ascii.arrow} Last action: travel sector-7</Text>
							<Text color={colors.success}>{ascii.bullet} Success: Travel initiated</Text>
						</Box>
					</Box>

					<Box
						borderStyle="single"
						borderColor={colors.border}
						height={Math.floor(contentHeight / 2)}
						flexGrow={1}
					>
						<Box flexDirection="column" padding={1}>
							<Text bold color={colors.accent}>
								{ascii.diamond} SOCIAL [CHAT | FORUM]
							</Text>
							<Text dimColor>{ascii.bullet} local | Trader_01: Anyone selling fuel?</Text>
							<Text dimColor>{ascii.bullet} Forum: Welcome to SpaceMolt! (42 replies)</Text>
						</Box>
					</Box>
				</Box>

				<Box flexDirection="column" width={sidebarWidth}>
					<Box
						borderStyle="single"
						borderColor={colors.border}
						height={Math.floor(contentHeight / 2)}
						flexGrow={1}
					>
						<Box flexDirection="column" padding={1}>
							<Text bold color={colors.info}>
								{ascii.star} SHIP STATUS
							</Text>
							<Text>Health: 85%</Text>
							<Text>Fuel: 42%</Text>
							<Text dimColor>Location: Alpha Centauri</Text>
						</Box>
					</Box>

					<Box
						borderStyle="single"
						borderColor={colors.border}
						height={Math.floor(contentHeight / 2)}
						flexGrow={1}
					>
						<Box flexDirection="column" padding={1}>
							<Text bold color={colors.warning}>
								{ascii.triangle} SERVER MESSAGES
							</Text>
							<Text dimColor>{ascii.bullet} Combat: Enemy detected</Text>
							<Text dimColor>{ascii.bullet} Trade: Market updated</Text>
						</Box>
					</Box>
				</Box>
			</Box>
		</Box>
	);
}

runTests("Layout Preview Tests", [
	{
		name: "Standard Terminal (120x30)",
		description: "Typical terminal size for desktop development",
		component: <LayoutPreview width={120} height={30} />,
	},
	{
		name: "Wide Terminal (160x40)",
		description: "Large monitor or split-screen setup",
		component: <LayoutPreview width={160} height={40} />,
	},
	{
		name: "Compact Terminal (80x24)",
		description: "Minimal viable size for the UI",
		component: <LayoutPreview width={80} height={24} />,
	},
	{
		name: "Narrow Terminal (100x30)",
		description: "Laptop or smaller screen",
		component: <LayoutPreview width={100} height={30} />,
	},
]);
