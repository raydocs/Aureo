export interface WebcamPreviewSizePreset {
	id: "small" | "medium" | "large";
	size: number;
}

export interface WebcamPreviewShapePreset {
	id: "circle" | "rounded" | "square";
	roundness: number;
}

export const WEBCAM_PREVIEW_SIZE_PRESETS: readonly WebcamPreviewSizePreset[] = [
	{ id: "small", size: 160 },
	{ id: "medium", size: 208 },
	{ id: "large", size: 288 },
] as const;

export const WEBCAM_PREVIEW_SHAPE_PRESETS: readonly WebcamPreviewShapePreset[] = [
	{ id: "circle", roundness: 100 },
	{ id: "rounded", roundness: 30 },
	{ id: "square", roundness: 0 },
] as const;

/** Preset sizes fed to the resize engine as snap magnets. */
export const WEBCAM_PREVIEW_SNAP_SIZES: readonly number[] = WEBCAM_PREVIEW_SIZE_PRESETS.map(
	(preset) => preset.size,
);
