import { loadAppSetting, saveAppSetting } from "@/lib/appSettings";
import { clampHudOffsetToViewport } from "./hudViewportBounds";

export interface WebcamPreviewPlacement {
	offsetX: number;
	offsetY: number;
	visible: boolean;
}

export const WEBCAM_PREVIEW_PLACEMENT_STORAGE_KEY = "aureo.hud.webcamPreviewPlacement";
export const WEBCAM_PREVIEW_ANCHOR = { right: 32, bottom: 120 } as const;
export const DEFAULT_WEBCAM_PREVIEW_PLACEMENT: WebcamPreviewPlacement = {
	offsetX: 0,
	offsetY: 0,
	visible: true,
};

function finiteOr(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeWebcamPreviewPlacement(value: unknown): WebcamPreviewPlacement {
	const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	return {
		offsetX: finiteOr(raw.offsetX, DEFAULT_WEBCAM_PREVIEW_PLACEMENT.offsetX),
		offsetY: finiteOr(raw.offsetY, DEFAULT_WEBCAM_PREVIEW_PLACEMENT.offsetY),
		visible: typeof raw.visible === "boolean" ? raw.visible : true,
	};
}

export function loadWebcamPreviewPlacement(): WebcamPreviewPlacement {
	return normalizeWebcamPreviewPlacement(
		loadAppSetting<unknown>(WEBCAM_PREVIEW_PLACEMENT_STORAGE_KEY),
	);
}

export function saveWebcamPreviewPlacement(value: WebcamPreviewPlacement): boolean {
	return saveAppSetting(
		WEBCAM_PREVIEW_PLACEMENT_STORAGE_KEY,
		normalizeWebcamPreviewPlacement(value),
	);
}

/**
 * Clamp a restored placement so the absolute preview rect lies fully inside the
 * viewport. Anchor is bottom-right: base left/top = viewport − anchor − size.
 */
export function resolveRestoredPreviewPlacement(
	saved: WebcamPreviewPlacement,
	viewport: { width: number; height: number },
	previewSize: number,
): WebcamPreviewPlacement {
	const left0 = viewport.width - WEBCAM_PREVIEW_ANCHOR.right - previewSize;
	const top0 = viewport.height - WEBCAM_PREVIEW_ANCHOR.bottom - previewSize;

	if (left0 < 0 || top0 < 0) {
		return {
			offsetX: 0,
			offsetY: 0,
			visible: saved.visible,
		};
	}

	const left = left0 + saved.offsetX;
	const top = top0 + saved.offsetY;
	const clamped = clampHudOffsetToViewport(
		{ x: saved.offsetX, y: saved.offsetY },
		{
			left,
			top,
			right: left + previewSize,
			bottom: top + previewSize,
		},
		viewport,
	);

	return {
		offsetX: clamped.x,
		offsetY: clamped.y,
		visible: saved.visible,
	};
}
