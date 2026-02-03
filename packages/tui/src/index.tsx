import React from "react";
import { Box, Text } from "ink";

export * from "./theme.ts";
export * from "./types.ts";

export function App() {
	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="double" borderColor="cyan" padding={1}>
				<Text bold color="cyan">
					SpaceMolt TUI
				</Text>
			</Box>
			<Box marginTop={1}>
				<Text>Welcome to the SpaceMolt terminal interface.</Text>
			</Box>
			<Box marginTop={1}>
				<Text dimColor>Press Ctrl+C to exit</Text>
			</Box>
		</Box>
	);
}
