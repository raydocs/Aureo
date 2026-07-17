export type EditorCommandGroup = "edit" | "add" | "view" | "project";

export interface EditorCommandDefinition {
	id: string;
	group: EditorCommandGroup;
	label: string;
	description?: string;
	keywords?: string[];
	shortcut?: string;
	disabled?: boolean;
	checked?: boolean;
	run: () => void | Promise<void>;
}

function normalizeSearchText(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function commandScore(command: EditorCommandDefinition, query: string): number | null {
	const normalizedQuery = normalizeSearchText(query);
	if (!normalizedQuery) return 0;

	const label = normalizeSearchText(command.label);
	const description = normalizeSearchText(command.description ?? "");
	const keywords = normalizeSearchText(command.keywords?.join(" ") ?? "");
	const haystack = `${label} ${description} ${keywords}`.trim();
	const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
	if (!tokens.every((token) => haystack.includes(token))) return null;

	let score = 0;
	if (label === normalizedQuery) score += 1_000;
	else if (label.startsWith(normalizedQuery)) score += 600;
	else if (label.split(" ").some((word) => word.startsWith(normalizedQuery))) score += 400;
	else if (label.includes(normalizedQuery)) score += 250;

	for (const token of tokens) {
		if (label.split(" ").some((word) => word.startsWith(token))) score += 80;
		else if (label.includes(token)) score += 50;
		else if (keywords.includes(token)) score += 25;
		else score += 10;
	}
	return score;
}

export function filterEditorCommands(
	commands: readonly EditorCommandDefinition[],
	query: string,
): EditorCommandDefinition[] {
	if (!normalizeSearchText(query)) return [...commands];

	return commands
		.map((command, index) => ({ command, index, score: commandScore(command, query) }))
		.filter(
			(entry): entry is { command: EditorCommandDefinition; index: number; score: number } =>
				entry.score !== null,
		)
		.sort((left, right) => right.score - left.score || left.index - right.index)
		.map((entry) => entry.command);
}

export function moveCommandSelection(
	currentIndex: number,
	direction: 1 | -1,
	commands: readonly EditorCommandDefinition[],
): number {
	if (commands.length === 0 || commands.every((command) => command.disabled)) return -1;

	let nextIndex = currentIndex;
	for (let attempts = 0; attempts < commands.length; attempts += 1) {
		nextIndex = (nextIndex + direction + commands.length) % commands.length;
		if (!commands[nextIndex].disabled) return nextIndex;
	}
	return -1;
}
