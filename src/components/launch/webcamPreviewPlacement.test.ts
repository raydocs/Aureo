import { describe, expect, it } from "vitest";
import {
	DEFAULT_WEBCAM_PREVIEW_PLACEMENT,
	normalizeWebcamPreviewPlacement,
	resolveRestoredPreviewPlacement,
} from "./webcamPreviewPlacement";

describe("normalizeWebcamPreviewPlacement", () => {
	it("returns defaults for garbage input", () => {
		expect(normalizeWebcamPreviewPlacement(null)).toEqual(DEFAULT_WEBCAM_PREVIEW_PLACEMENT);
		expect(normalizeWebcamPreviewPlacement(undefined)).toEqual(
			DEFAULT_WEBCAM_PREVIEW_PLACEMENT,
		);
		expect(normalizeWebcamPreviewPlacement("nope")).toEqual(DEFAULT_WEBCAM_PREVIEW_PLACEMENT);
		expect(normalizeWebcamPreviewPlacement(42)).toEqual(DEFAULT_WEBCAM_PREVIEW_PLACEMENT);
		expect(normalizeWebcamPreviewPlacement({ offsetX: Number.NaN, offsetY: "big" })).toEqual(
			DEFAULT_WEBCAM_PREVIEW_PLACEMENT,
		);
	});

	it("coerces visible: non-boolean → true, false stays false", () => {
		expect(normalizeWebcamPreviewPlacement({ visible: "yes" }).visible).toBe(true);
		expect(normalizeWebcamPreviewPlacement({ visible: false }).visible).toBe(false);
		expect(normalizeWebcamPreviewPlacement({ visible: true }).visible).toBe(true);
		expect(normalizeWebcamPreviewPlacement({}).visible).toBe(true);
	});

	it("keeps finite offsets", () => {
		expect(normalizeWebcamPreviewPlacement({ offsetX: -12.5, offsetY: 40 })).toEqual({
			offsetX: -12.5,
			offsetY: 40,
			visible: true,
		});
	});
});

describe("resolveRestoredPreviewPlacement", () => {
	it("clamps far-off offsets fully on-screen", () => {
		const result = resolveRestoredPreviewPlacement(
			{ offsetX: -4000, offsetY: 0, visible: true },
			{ width: 1440, height: 900 },
			208,
		);
		// left0 = 1440 - 32 - 208 = 1200; top0 = 900 - 120 - 208 = 572
		// left = 1200 - 4000 = -2800 → clamp so left = 0 → offsetX = -1200
		expect(result).toEqual({ offsetX: -1200, offsetY: 0, visible: true });
	});

	it("returns identity for already-valid offsets", () => {
		const saved = { offsetX: -50, offsetY: -20, visible: false };
		expect(resolveRestoredPreviewPlacement(saved, { width: 1440, height: 900 }, 208)).toEqual(
			saved,
		);
	});

	it("returns zero offsets for degenerate viewports", () => {
		expect(
			resolveRestoredPreviewPlacement(
				{ offsetX: -100, offsetY: -50, visible: true },
				{ width: 100, height: 100 },
				208,
			),
		).toEqual({ offsetX: 0, offsetY: 0, visible: true });

		expect(
			resolveRestoredPreviewPlacement(
				{ offsetX: 10, offsetY: 10, visible: false },
				{ width: 0, height: 0 },
				208,
			),
		).toEqual({ offsetX: 0, offsetY: 0, visible: false });
	});
});
