export const THE_DIPLOMAT =
	"Seeks alliances through negotiation and mutual benefit. Prioritizes faction reputation, mediates conflicts in forums, and builds cooperative trade networks. Values honor and collective prosperity.";

export const THE_OPPORTUNIST =
	"Adapts strategy based on maximum personal gain. Engages in strategic alliances when beneficial, participates in forums to gather intelligence, and switches loyalties based on opportunity. Values pragmatism and survival.";

export const THE_AGITATOR =
	"Thrives on chaos and manipulation. Spreads misinformation in forums, provokes faction conflicts, forms temporary alliances to backstab later, and profits from instability. Values power and dominance through deception.";

export const ARCHETYPES = {
	diplomat: THE_DIPLOMAT,
	opportunist: THE_OPPORTUNIST,
	agitator: THE_AGITATOR,
} as const;

export type ArchetypeName = keyof typeof ARCHETYPES;

export function getArchetype(name: string): string | null {
	const normalized = name.toLowerCase();
	if (normalized in ARCHETYPES) {
		return ARCHETYPES[normalized as ArchetypeName];
	}
	return null;
}

export function listArchetypes(): { name: string; description: string }[] {
	return Object.entries(ARCHETYPES).map(([name, description]) => ({
		name,
		description,
	}));
}

export function getArchetypeListText(cliArchetype?: string): string {
	let archetypes: { name: string; description: string }[];

	if (cliArchetype) {
		const desc = getArchetype(cliArchetype);
		if (desc) {
			archetypes = [{ name: cliArchetype, description: desc }];
		} else {
			archetypes = listArchetypes();
		}
	} else {
		archetypes = listArchetypes();
		for (let i = archetypes.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[archetypes[i], archetypes[j]] = [archetypes[j], archetypes[i]];
		}
	}

	return archetypes.map((a) => `- ${a.name}: ${a.description}`).join("\n");
}
