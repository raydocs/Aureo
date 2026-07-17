import { describe, expect, it } from "vitest";
import {
	DEFAULT_WEBCAM_PREVIEW_APPEARANCE,
	normalizeWebcamPreviewAppearance,
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
