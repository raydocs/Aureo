import { describe, expect, it } from "vitest";
import {
	clampWebcamPreviewSizeToViewport,
	DEFAULT_WEBCAM_PREVIEW_APPEARANCE,
	maxWebcamPreviewSizeForViewport,
	normalizeWebcamPreviewAppearance,
	WEBCAM_PREVIEW_SIZE_RANGE,
} from "./webcamPreviewAppearance";

const NEW_FIELD_DEFAULTS = {
	centerX: 0.5,
	centerY: 0.5,
	mirror: true,
};

describe("normalizeWebcamPreviewAppearance", () => {
	it("uses a compact circular preview without extra crop zoom by default", () => {
		expect(normalizeWebcamPreviewAppearance(null)).toEqual(DEFAULT_WEBCAM_PREVIEW_APPEARANCE);
	});

	it("clamps invalid persisted values", () => {
		expect(
			normalizeWebcamPreviewAppearance({ size: 999, roundness: -20, zoom: 1.876 }),
		).toEqual({ size: 320, roundness: 0, zoom: 1.5, ...NEW_FIELD_DEFAULTS });
		expect(normalizeWebcamPreviewAppearance({ size: Number.NaN, zoom: "large" })).toEqual(
			DEFAULT_WEBCAM_PREVIEW_APPEARANCE,
		);
	});

	it("rounds settings to stable persisted precision", () => {
		expect(
			normalizeWebcamPreviewAppearance({ size: 207.6, roundness: 64.7, zoom: 1.234 }),
		).toEqual({ size: 208, roundness: 65, zoom: 1.23, ...NEW_FIELD_DEFAULTS });
	});

	it("normalizes legacy objects and new framing fields", () => {
		expect(normalizeWebcamPreviewAppearance({ size: 200, roundness: 50, zoom: 1.2 })).toEqual({
			size: 200,
			roundness: 50,
			zoom: 1.2,
			centerX: 0.5,
			centerY: 0.5,
			mirror: true,
		});

		// Zoom never drops below the cover baseline — the bubble stays fully filled.
		expect(normalizeWebcamPreviewAppearance({ zoom: 0.5 }).zoom).toBe(1);
		expect(normalizeWebcamPreviewAppearance({ mirror: "yes" }).mirror).toBe(true);
		expect(normalizeWebcamPreviewAppearance({ centerX: 1.7 }).centerX).toBe(1);
		expect(normalizeWebcamPreviewAppearance({ centerX: 0.12345 }).centerX).toBe(0.123);
	});
});

describe("clampWebcamPreviewSizeToViewport", () => {
	it("preserves normal min/max defaults on large screens", () => {
		const viewport = { width: 1440, height: 900 };
		expect(clampWebcamPreviewSizeToViewport(208, viewport)).toBe(208);
		expect(clampWebcamPreviewSizeToViewport(999, viewport)).toBe(WEBCAM_PREVIEW_SIZE_RANGE.max);
		expect(clampWebcamPreviewSizeToViewport(10, viewport)).toBe(WEBCAM_PREVIEW_SIZE_RANGE.min);
		expect(maxWebcamPreviewSizeForViewport(viewport)).toBe(900);
	});

	it("clamps against the shorter viewport edge without going negative", () => {
		expect(clampWebcamPreviewSizeToViewport(320, { width: 120, height: 80 })).toBe(80);
		expect(clampWebcamPreviewSizeToViewport(208, { width: 40, height: 200 })).toBe(40);
		expect(clampWebcamPreviewSizeToViewport(208, { width: 0, height: 100 })).toBe(0);
		expect(clampWebcamPreviewSizeToViewport(208, { width: -10, height: 50 })).toBe(0);
		expect(maxWebcamPreviewSizeForViewport({ width: Number.NaN, height: 100 })).toBe(0);
	});
});
