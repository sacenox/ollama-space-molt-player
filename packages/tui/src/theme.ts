export const colors = {
	primary: "cyan",
	secondary: "blue",
	accent: "magenta",

	success: "green",
	warning: "yellow",
	error: "red",
	info: "cyan",

	border: "blue",
	text: "white",
	textDim: "gray",
	background: "black",

	active: "cyan",
	inactive: "gray",
	highlight: "magenta",
} as const;

export const boxChars = {
	horizontal: "─",
	vertical: "│",
	topLeft: "┌",
	topRight: "┐",
	bottomLeft: "└",
	bottomRight: "┘",
	cross: "┼",
	teeUp: "┴",
	teeDown: "┬",
	teeLeft: "┤",
	teeRight: "├",

	doubleHorizontal: "═",
	doubleVertical: "║",
	doubleTopLeft: "╔",
	doubleTopRight: "╗",
	doubleBottomLeft: "╚",
	doubleBottomRight: "╝",
} as const;

export const ascii = {
	bullet: "•",
	arrow: "→",
	ellipsis: "...",
	separator: "─",
	star: "★",
	diamond: "◆",
	circle: "●",
	square: "■",
	triangle: "▲",
} as const;

export const layout = {
	headerHeight: 3,
	sidebarWidth: 30,
	minWidth: 80,
	minHeight: 24,
} as const;
