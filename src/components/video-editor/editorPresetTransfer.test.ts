import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_EDITOR_PREFERENCES,
	type EditorPreset,
	loadEditorPresets,
	saveEditorPresets,
} from "./editorPreferences";
import {
	createEditorPresetTransferEnvelope,
	EDITOR_PRESET_TRANSFER_VERSION,
	isEditorPresetTransferEnvelope,
	parseEditorPresetTransferPayload,
	resolveImportConflicts,
	sanitizePresetFileName,
} from "./editorPresetTransfer";
import { DEFAULT_AUTO_CAPTION_SETTINGS, DEFAULT_CROP_REGION } from "./types";

function createStorageMock(initialValues: Record<string, string> = {}): Storage {
	const store = new Map(Object.entries(initialValues));

	return {
		get length() {
			return store.size;
		},
		clear() {
			store.clear();
		},
		getItem(key) {
			return store.get(key) ?? null;
		},
		key(index) {
			return Array.from(store.keys())[index] ?? null;
		},
		removeItem(key) {
			store.delete(key);
		},
		setItem(key, value) {
			store.set(key, value);
		},
	};
}

function createMinimalPreset(overrides: Partial<EditorPreset> = {}): EditorPreset {
	const timestamp = new Date().toISOString();
	return {
		id: "preset-import-1",
		name: "Imported Preset",
		createdAt: timestamp,
		updatedAt: timestamp,
		snapshot: {
			...DEFAULT_EDITOR_PREFERENCES,
			cropRegion: DEFAULT_CROP_REGION,
			autoCaptionSettings: DEFAULT_AUTO_CAPTION_SETTINGS,
			whisperExecutablePath: null,
			whisperModelPath: null,
		},
		...overrides,
	};
}

describe("editorPresetTransfer", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("envelope helpers", () => {
		it("creates a valid envelope", () => {
			const preset = createMinimalPreset({ name: "Test" });
			const envelope = createEditorPresetTransferEnvelope(preset);

			expect(envelope).toEqual({
				version: EDITOR_PRESET_TRANSFER_VERSION,
				app: "aureo",
				kind: "editor-preset",
				preset,
			});
			expect(isEditorPresetTransferEnvelope(envelope)).toBe(true);
		});

		it("removes machine-local paths from exported presets", () => {
			const preset = createMinimalPreset({
				snapshot: {
					...createMinimalPreset().snapshot,
					whisperExecutablePath: "/Users/example/bin/whisper",
					whisperModelPath: "/Users/example/models/whisper.bin",
				},
			});

			const envelope = createEditorPresetTransferEnvelope(preset);
			expect(envelope.preset).toMatchObject({
				snapshot: {
					whisperExecutablePath: null,
					whisperModelPath: null,
				},
			});
		});

		it("rejects non-object payloads", () => {
			expect(isEditorPresetTransferEnvelope(null)).toBe(false);
			expect(isEditorPresetTransferEnvelope("string")).toBe(false);
			expect(isEditorPresetTransferEnvelope(123)).toBe(false);
		});

		it("rejects wrong version, app, or kind", () => {
			const preset = createMinimalPreset();
			expect(
				isEditorPresetTransferEnvelope({
					version: 2,
					app: "aureo",
					kind: "editor-preset",
					preset,
				}),
			).toBe(false);
			expect(
				isEditorPresetTransferEnvelope({
					version: EDITOR_PRESET_TRANSFER_VERSION,
					app: "other",
					kind: "editor-preset",
					preset,
				}),
			).toBe(false);
			expect(
				isEditorPresetTransferEnvelope({
					version: EDITOR_PRESET_TRANSFER_VERSION,
					app: "aureo",
					kind: "project",
					preset,
				}),
			).toBe(false);
		});

		it("rejects missing or non-object preset", () => {
			expect(
				isEditorPresetTransferEnvelope({
					version: EDITOR_PRESET_TRANSFER_VERSION,
					app: "aureo",
					kind: "editor-preset",
				}),
			).toBe(false);
			expect(
				isEditorPresetTransferEnvelope({
					version: EDITOR_PRESET_TRANSFER_VERSION,
					app: "aureo",
					kind: "editor-preset",
					preset: "nope",
				}),
			).toBe(false);
		});
	});

	describe("sanitizePresetFileName", () => {
		it("slugifies regular names", () => {
			expect(sanitizePresetFileName("My Cool Preset!")).toBe("my-cool-preset");
		});

		it("returns a fallback for whitespace-only input", () => {
			expect(sanitizePresetFileName("   ")).toBe("preset");
		});

		it("returns a fallback when all characters are stripped", () => {
			expect(sanitizePresetFileName("!@#")).toBe("preset");
		});

		it("collapses repeated separators", () => {
			expect(sanitizePresetFileName("a--b  c")).toBe("a-b-c");
		});

		it("caps length", () => {
			const long = "a".repeat(200);
			expect(sanitizePresetFileName(long).length).toBe(96);
		});
	});

	describe("import parsing", () => {
		it("parses a valid versioned preset and removes machine-local paths", () => {
			const preset = createMinimalPreset({
				name: "Imported Preset",
				snapshot: {
					...createMinimalPreset().snapshot,
					whisperExecutablePath: "/Users/example/bin/whisper",
					whisperModelPath: "/Users/example/models/whisper.bin",
				},
			});
			const result = parseEditorPresetTransferPayload({
				version: EDITOR_PRESET_TRANSFER_VERSION,
				app: "aureo",
				kind: "editor-preset",
				preset,
			});

			expect(result).toMatchObject({
				success: true,
				preset: {
					id: preset.id,
					name: "Imported Preset",
					snapshot: {
						whisperExecutablePath: null,
						whisperModelPath: null,
					},
				},
			});
		});

		it("rejects unsupported versions and unversioned raw presets", () => {
			const preset = createMinimalPreset();
			expect(
				parseEditorPresetTransferPayload({
					version: EDITOR_PRESET_TRANSFER_VERSION + 1,
					app: "aureo",
					kind: "editor-preset",
					preset,
				}),
			).toEqual({ success: false, reason: "unsupported-version" });
			expect(parseEditorPresetTransferPayload(preset)).toEqual({
				success: false,
				reason: "malformed",
			});
		});

		it("rejects empty names and missing snapshots", () => {
			expect(
				parseEditorPresetTransferPayload({
					version: EDITOR_PRESET_TRANSFER_VERSION,
					app: "aureo",
					kind: "editor-preset",
					preset: createMinimalPreset({ name: "   " }),
				}),
			).toEqual({ success: false, reason: "empty-name" });

			const presetWithoutSnapshot = createMinimalPreset() as unknown as Record<
				string,
				unknown
			>;
			delete presetWithoutSnapshot.snapshot;
			expect(
				parseEditorPresetTransferPayload({
					version: EDITOR_PRESET_TRANSFER_VERSION,
					app: "aureo",
					kind: "editor-preset",
					preset: presetWithoutSnapshot,
				}),
			).toEqual({ success: false, reason: "invalid-snapshot" });
			expect(
				parseEditorPresetTransferPayload({
					version: EDITOR_PRESET_TRANSFER_VERSION,
					app: "aureo",
					kind: "editor-preset",
					preset: { ...createMinimalPreset(), snapshot: {} },
				}),
			).toEqual({ success: false, reason: "invalid-snapshot" });
		});
	});

	describe("duplicate resolution", () => {
		it("renames a duplicate name deterministically", () => {
			const localStorage = createStorageMock();
			vi.stubGlobal("localStorage", localStorage);

			const existing = createMinimalPreset({
				id: "existing-1",
				name: "Demo Preset",
				updatedAt: "2026-01-01T00:00:00.000Z",
			});
			const imported = createMinimalPreset({
				id: "existing-1",
				name: "Demo Preset",
				updatedAt: "2026-02-01T00:00:00.000Z",
			});

			expect(saveEditorPresets([existing])).toBe(true);
			const loaded = loadEditorPresets();
			expect(loaded).toHaveLength(1);

			const resolved = resolveImportConflicts(imported, loaded);
			expect(resolved.name).toBe("Demo Preset (imported 1)");
			expect(resolved.id).toBe("existing-1-imported-1");
		});

		it("increments the counter for multiple duplicate names", () => {
			const localStorage = createStorageMock();
			vi.stubGlobal("localStorage", localStorage);

			const existing = createMinimalPreset({
				id: "existing-1",
				name: "Demo Preset",
				updatedAt: "2026-01-01T00:00:00.000Z",
			});
			const imported1 = createMinimalPreset({
				id: "import-1",
				name: "Demo Preset",
				updatedAt: "2026-02-01T00:00:00.000Z",
			});
			const imported2 = createMinimalPreset({
				id: "import-2",
				name: "Demo Preset",
				updatedAt: "2026-03-01T00:00:00.000Z",
			});

			expect(saveEditorPresets([existing])).toBe(true);
			const loaded = loadEditorPresets();

			const resolved1 = resolveImportConflicts(imported1, loaded);
			const resolved2 = resolveImportConflicts(imported2, [...loaded, resolved1]);
			expect(resolved1.name).toBe("Demo Preset (imported 1)");
			expect(resolved2.name).toBe("Demo Preset (imported 2)");
		});

		it("does not overwrite a duplicate id by assigning a new id", () => {
			const localStorage = createStorageMock();
			vi.stubGlobal("localStorage", localStorage);

			const existing = createMinimalPreset({
				id: "duplicate-id",
				name: "Existing Preset",
				updatedAt: "2026-01-01T00:00:00.000Z",
			});
			const imported = createMinimalPreset({
				id: "duplicate-id",
				name: "Different Name",
				updatedAt: "2026-02-01T00:00:00.000Z",
			});

			expect(saveEditorPresets([existing])).toBe(true);
			const resolved = resolveImportConflicts(imported, loadEditorPresets());
			expect(resolved.id).toBe("duplicate-id-imported-1");
			expect(resolved.name).toBe("Different Name");
		});

		it("keeps the name and id when there are no conflicts", () => {
			const existing = createMinimalPreset({
				id: "existing-1",
				name: "Existing Preset",
			});
			const imported = createMinimalPreset({
				id: "imported-1",
				name: "Imported Preset",
			});

			const resolved = resolveImportConflicts(imported, [existing]);
			expect(resolved.id).toBe("imported-1");
			expect(resolved.name).toBe("Imported Preset");
		});
	});
});
