export type RecordingQualityPresetId = "standard" | "high" | "ultra";

export type RecordingQualityPreset = {
	id: RecordingQualityPresetId;
	label: string;
	resolutionLabel: string;
	maxWidth: number;
	maxHeight: number;
	frameRate: 30 | 60;
};

export const RECORDING_QUALITY_PRESETS: readonly RecordingQualityPreset[] = [
	{
		id: "standard",
		label: "Standard",
		resolutionLabel: "1080p",
		maxWidth: 1920,
		maxHeight: 1080,
		frameRate: 30,
	},
	{
		id: "high",
		label: "High",
		resolutionLabel: "1440p",
		maxWidth: 2560,
		maxHeight: 1440,
		frameRate: 60,
	},
	{
		id: "ultra",
		label: "Ultra",
		resolutionLabel: "4K",
		maxWidth: 3840,
		maxHeight: 2160,
		frameRate: 60,
	},
] as const;

export const DEFAULT_RECORDING_QUALITY_PRESET_ID: RecordingQualityPresetId = "ultra";

const RECORDING_QUALITY_PRESET_STORAGE_KEY = "aureo.recording.qualityPreset";

export function getRecordingQualityPreset(
	presetId: RecordingQualityPresetId,
): RecordingQualityPreset {
	return (
		RECORDING_QUALITY_PRESETS.find((preset) => preset.id === presetId) ??
		RECORDING_QUALITY_PRESETS[RECORDING_QUALITY_PRESETS.length - 1]
	);
}

export function loadRecordingQualityPreset(): RecordingQualityPresetId {
	if (typeof localStorage === "undefined") {
		return DEFAULT_RECORDING_QUALITY_PRESET_ID;
	}

	const stored = localStorage.getItem(RECORDING_QUALITY_PRESET_STORAGE_KEY);
	return RECORDING_QUALITY_PRESETS.some((preset) => preset.id === stored)
		? (stored as RecordingQualityPresetId)
		: DEFAULT_RECORDING_QUALITY_PRESET_ID;
}

export function saveRecordingQualityPreset(presetId: RecordingQualityPresetId): void {
	if (typeof localStorage === "undefined") {
		return;
	}

	localStorage.setItem(RECORDING_QUALITY_PRESET_STORAGE_KEY, presetId);
}

export function computeRecordingBitrate(width: number, height: number, frameRate: number): number {
	const pixels = width * height;
	const highFrameRateBoost = frameRate >= 60 ? 1.7 : 1;
	const baseBitrate =
		pixels >= 3840 * 2160 ? 45_000_000 : pixels >= 2560 * 1440 ? 28_000_000 : 18_000_000;

	return Math.round(baseBitrate * highFrameRateBoost);
}
