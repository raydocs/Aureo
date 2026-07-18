import { loadAppSetting, saveAppSetting } from "@/lib/appSettings";
import { clampHudOffsetToViewport } from "./hudViewportBounds";
import { clampWebcamPreviewSizeToViewport } from "./webcamPreviewAppearance";

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
 *
 * Always offset-clamps (including when the un-offset base sits off-screen due to
 * anchors or a large size). Callers should size-clamp first when the square may
 * exceed the viewport; otherwise one edge can still overflow.
 */
export function resolveRestoredPreviewPlacement(
	saved: WebcamPreviewPlacement,
	viewport: { width: number; height: number },
	previewSize: number,
): WebcamPreviewPlacement {
	const safeSize =
		typeof previewSize === "number" && Number.isFinite(previewSize) && previewSize > 0
			? previewSize
			: 0;

	const left0 = viewport.width - WEBCAM_PREVIEW_ANCHOR.right - safeSize;
	const top0 = viewport.height - WEBCAM_PREVIEW_ANCHOR.bottom - safeSize;
	const left = left0 + saved.offsetX;
	const top = top0 + saved.offsetY;
	const clamped = clampHudOffsetToViewport(
		{ x: saved.offsetX, y: saved.offsetY },
		{
			left,
			top,
			right: left + safeSize,
			bottom: top + safeSize,
		},
		viewport,
	);

	return {
		offsetX: clamped.x,
		offsetY: clamped.y,
		visible: saved.visible,
	};
}

/**
 * Fit both size and placement so the full preview square remains visible after
 * restore or a viewport/display size change.
 */
export function resolveViewportConstrainedPreview(params: {
	size: number;
	placement: WebcamPreviewPlacement;
	viewport: { width: number; height: number };
}): { size: number; placement: WebcamPreviewPlacement } {
	const size = clampWebcamPreviewSizeToViewport(params.size, params.viewport);
	const placement = resolveRestoredPreviewPlacement(params.placement, params.viewport, size);
	return { size, placement };
}
