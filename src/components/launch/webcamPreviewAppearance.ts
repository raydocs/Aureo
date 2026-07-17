import { loadAppSetting, saveAppSetting } from "@/lib/appSettings";

export type WebcamPreviewFitMode = "fill" | "fit";

export interface WebcamPreviewAppearance {
	size: number;
	roundness: number;
	// Crop-based zoom on top of the cover baseline: 1 ≈ CSS cover; >1 crops tighter.
	// Never below cover — the bubble must always be fully filled by sharp video.
	zoom: number;
	/** Framing center in UNMIRRORED source coords, 0–1. */
	centerX: number;
	/** Framing center in source coords, 0–1. */
	centerY: number;
	mirror: boolean;
}

export const WEBCAM_PREVIEW_APPEARANCE_STORAGE_KEY = "aureo.hud.webcamPreviewAppearance";
export const WEBCAM_PREVIEW_SIZE_RANGE = { min: 144, max: 320 } as const;
export const WEBCAM_PREVIEW_ZOOM_RANGE = { min: 1, max: 1.5 } as const;

export const DEFAULT_WEBCAM_PREVIEW_APPEARANCE: WebcamPreviewAppearance = {
	size: 208,
	roundness: 100,
	zoom: 1,
	centerX: 0.5,
	centerY: 0.5,
	mirror: true,
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function finiteOr(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCenter(value: unknown, fallback: number): number {
	return Math.round(clamp(finiteOr(value, fallback), 0, 1) * 1000) / 1000;
}

export function normalizeWebcamPreviewAppearance(value: unknown): WebcamPreviewAppearance {
	const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	return {
		size: Math.round(
			clamp(
				finiteOr(raw.size, DEFAULT_WEBCAM_PREVIEW_APPEARANCE.size),
				WEBCAM_PREVIEW_SIZE_RANGE.min,
				WEBCAM_PREVIEW_SIZE_RANGE.max,
			),
		),
		roundness: Math.round(
			clamp(finiteOr(raw.roundness, DEFAULT_WEBCAM_PREVIEW_APPEARANCE.roundness), 0, 100),
		),
		zoom:
			Math.round(
				clamp(
					finiteOr(raw.zoom, DEFAULT_WEBCAM_PREVIEW_APPEARANCE.zoom),
					WEBCAM_PREVIEW_ZOOM_RANGE.min,
					WEBCAM_PREVIEW_ZOOM_RANGE.max,
				) * 100,
			) / 100,
		centerX: normalizeCenter(raw.centerX, DEFAULT_WEBCAM_PREVIEW_APPEARANCE.centerX),
		centerY: normalizeCenter(raw.centerY, DEFAULT_WEBCAM_PREVIEW_APPEARANCE.centerY),
		mirror: typeof raw.mirror === "boolean" ? raw.mirror : true,
	};
}

/** Live in-memory appearance so record-start can avoid debounce-stale disk loads. */
let currentWebcamPreviewAppearance: WebcamPreviewAppearance | null = null;

export function cacheWebcamPreviewAppearance(value: WebcamPreviewAppearance): void {
	currentWebcamPreviewAppearance = value;
}

export function getCurrentWebcamPreviewAppearance(): WebcamPreviewAppearance {
	return currentWebcamPreviewAppearance ?? loadWebcamPreviewAppearance();
}

export function loadWebcamPreviewAppearance(): WebcamPreviewAppearance {
	const appearance = normalizeWebcamPreviewAppearance(
		loadAppSetting<unknown>(WEBCAM_PREVIEW_APPEARANCE_STORAGE_KEY),
	);
	currentWebcamPreviewAppearance = appearance;
	return appearance;
}

export function saveWebcamPreviewAppearance(value: WebcamPreviewAppearance): boolean {
	return saveAppSetting(
		WEBCAM_PREVIEW_APPEARANCE_STORAGE_KEY,
		normalizeWebcamPreviewAppearance(value),
	);
}
