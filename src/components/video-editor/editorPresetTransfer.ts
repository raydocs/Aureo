import { type EditorPreset, normalizeEditorPresetInput } from "./editorPreferences";

export const EDITOR_PRESET_TRANSFER_VERSION = 1;
export const EDITOR_PRESET_TRANSFER_FILE_EXTENSION = ".aureo-preset.json";
export const EDITOR_PRESET_TRANSFER_EXPORT_MIME_TYPE = "application/x-aureo-preset+json";
export const EDITOR_PRESET_TRANSFER_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB

const REQUIRED_TRANSFER_SNAPSHOT_KEYS = [
	"wallpaper",
	"padding",
	"webcam",
	"cropRegion",
	"autoCaptionSettings",
] as const;

export interface EditorPresetTransferEnvelope {
	version: typeof EDITOR_PRESET_TRANSFER_VERSION;
	app: "aureo";
	kind: "editor-preset";
	preset: unknown;
}

export type EditorPresetTransferParseResult =
	| { success: true; preset: EditorPreset }
	| {
			success: false;
			reason: "malformed" | "unsupported-version" | "empty-name" | "invalid-snapshot";
	  };

export function isEditorPresetTransferEnvelope(
	value: unknown,
): value is EditorPresetTransferEnvelope {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const candidate = value as Partial<EditorPresetTransferEnvelope>;
	return (
		candidate.version === EDITOR_PRESET_TRANSFER_VERSION &&
		candidate.app === "aureo" &&
		candidate.kind === "editor-preset" &&
		candidate.preset !== undefined &&
		candidate.preset !== null &&
		typeof candidate.preset === "object" &&
		!Array.isArray(candidate.preset)
	);
}

function sanitizeTransferredPreset(preset: EditorPreset): EditorPreset {
	return {
		...preset,
		snapshot: {
			...preset.snapshot,
			// Local executable/model paths are machine-specific and must not travel
			// with an otherwise portable presentation preset.
			whisperExecutablePath: null,
			whisperModelPath: null,
		},
	};
}

export function parseEditorPresetTransferPayload(value: unknown): EditorPresetTransferParseResult {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return { success: false, reason: "malformed" };
	}

	const candidate = value as Partial<EditorPresetTransferEnvelope>;
	if (
		candidate.app === "aureo" &&
		candidate.kind === "editor-preset" &&
		candidate.version !== EDITOR_PRESET_TRANSFER_VERSION
	) {
		return { success: false, reason: "unsupported-version" };
	}

	if (!isEditorPresetTransferEnvelope(candidate)) {
		return { success: false, reason: "malformed" };
	}

	const rawPreset = candidate.preset as Record<string, unknown>;
	if (typeof rawPreset.name !== "string" || rawPreset.name.trim().length === 0) {
		return { success: false, reason: "empty-name" };
	}
	if (
		!rawPreset.snapshot ||
		typeof rawPreset.snapshot !== "object" ||
		Array.isArray(rawPreset.snapshot)
	) {
		return { success: false, reason: "invalid-snapshot" };
	}
	const rawSnapshot = rawPreset.snapshot as Record<string, unknown>;
	if (REQUIRED_TRANSFER_SNAPSHOT_KEYS.some((key) => !(key in rawSnapshot))) {
		return { success: false, reason: "invalid-snapshot" };
	}

	const preset = normalizeEditorPresetInput(rawPreset);
	if (!preset) {
		return { success: false, reason: "invalid-snapshot" };
	}

	return { success: true, preset: sanitizeTransferredPreset(preset) };
}

export function createEditorPresetTransferEnvelope(
	preset: EditorPreset,
): EditorPresetTransferEnvelope {
	return {
		version: EDITOR_PRESET_TRANSFER_VERSION,
		app: "aureo",
		kind: "editor-preset",
		preset: sanitizeTransferredPreset(preset),
	};
}

export function sanitizePresetFileName(name: string): string {
	const trimmed = name.trim();
	if (trimmed.length === 0) {
		return "preset";
	}

	const slugified = trimmed
		.toLowerCase()
		.replace(/[^a-z0-9\s-_]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.slice(0, 96);

	return slugified.length > 0 ? slugified : "preset";
}

export function resolveImportConflicts(
	preset: EditorPreset,
	existing: EditorPreset[],
): EditorPreset {
	const existingIds = new Set(existing.map((item) => item.id));
	const existingNames = new Set(existing.map((item) => item.name.toLowerCase()));
	const portablePreset = sanitizeTransferredPreset(preset);

	let nextId = portablePreset.id;
	if (existingIds.has(nextId)) {
		let suffix = 1;
		let candidate = `${nextId}-imported-${suffix}`;
		while (existingIds.has(candidate)) {
			suffix += 1;
			candidate = `${nextId}-imported-${suffix}`;
		}
		nextId = candidate;
	}

	let nextName = portablePreset.name;
	if (existingNames.has(nextName.toLowerCase())) {
		let suffix = 1;
		let candidate = `${nextName} (imported ${suffix})`;
		while (existingNames.has(candidate.toLowerCase())) {
			suffix += 1;
			candidate = `${nextName} (imported ${suffix})`;
		}
		nextName = candidate;
	}

	return {
		...portablePreset,
		id: nextId,
		name: nextName,
		updatedAt: new Date().toISOString(),
	};
}
