import { describe, expect, it, vi } from "vitest";
import {
	type EditorCommandDefinition,
	filterEditorCommands,
	moveCommandSelection,
} from "./commandMenuModel";

function command(
	id: string,
	label: string,
	options: Partial<EditorCommandDefinition> = {},
): EditorCommandDefinition {
	return {
		id,
		label,
		group: "edit",
		run: vi.fn(),
		...options,
	};
}

describe("command menu model", () => {
	it("matches labels, descriptions and keywords while ranking label prefixes first", () => {
		const commands = [
			command("export", "Export video", { keywords: ["render", "share"] }),
			command("mask", "Sensitive data mask", { description: "Conceal private details" }),
			command("view", "Open export settings"),
		];

		expect(filterEditorCommands(commands, "export").map(({ id }) => id)).toEqual([
			"export",
			"view",
		]);
		expect(filterEditorCommands(commands, "private").map(({ id }) => id)).toEqual(["mask"]);
		expect(filterEditorCommands(commands, "render share").map(({ id }) => id)).toEqual([
			"export",
		]);
	});

	it("normalizes accents and returns the original order for an empty query", () => {
		const commands = [command("camera", "Cámara"), command("captions", "Captions")];
		expect(filterEditorCommands(commands, "camara").map(({ id }) => id)).toEqual(["camera"]);
		expect(filterEditorCommands(commands, " ")).toEqual(commands);
	});

	it("wraps keyboard selection and skips disabled commands", () => {
		const commands = [
			command("first", "First", { disabled: true }),
			command("second", "Second"),
			command("third", "Third", { disabled: true }),
		];
		expect(moveCommandSelection(-1, 1, commands)).toBe(1);
		expect(moveCommandSelection(1, 1, commands)).toBe(1);
		expect(moveCommandSelection(1, -1, commands)).toBe(1);
		expect(moveCommandSelection(-1, 1, [])).toBe(-1);
	});
});
