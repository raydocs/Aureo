import { describe, expect, it } from "vitest";
import {
	DEFAULT_WEBCAM_PREVIEW_PLACEMENT,
	normalizeWebcamPreviewPlacement,
	resolveRestoredPreviewPlacement,
	resolveViewportConstrainedPreview,
	WEBCAM_PREVIEW_ANCHOR,
} from "./webcamPreviewPlacement";

function absolutePreviewRect(
	viewport: { width: number; height: number },
	size: number,
	offset: { offsetX: number; offsetY: number },
) {
	const left = viewport.width - WEBCAM_PREVIEW_ANCHOR.right - size + offset.offsetX;
	const top = viewport.height - WEBCAM_PREVIEW_ANCHOR.bottom - size + offset.offsetY;
	return { left, top, right: left + size, bottom: top + size };
}

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

	it("prevents right-edge clipping after a large positive offset", () => {
		const viewport = { width: 1440, height: 900 };
		const size = 208;
		const result = resolveRestoredPreviewPlacement(
			{ offsetX: 500, offsetY: 0, visible: true },
			viewport,
			size,
		);
		const rect = absolutePreviewRect(viewport, size, result);
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.right).toBeLessThanOrEqual(viewport.width);
		expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
		// left0 = 1200; max left = 1440 - 208 = 1232 → offsetX = 32
		expect(result).toEqual({ offsetX: 32, offsetY: 0, visible: true });
	});

	it("clamps offsets even when the un-offset base sits off-screen", () => {
		const viewport = { width: 100, height: 100 };
		const size = 80;
		const result = resolveRestoredPreviewPlacement(
			{ offsetX: -100, offsetY: -50, visible: true },
			viewport,
			size,
		);
		const rect = absolutePreviewRect(viewport, size, result);
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.right).toBeLessThanOrEqual(viewport.width);
		expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
		expect(result.visible).toBe(true);
	});

	it("clamps a zero-size preview onto a degenerate viewport origin", () => {
		// left0 = 0 - 32 - 0 = -32; top0 = 0 - 120 - 0 = -120
		// clamp moves the point to (0,0) → offsetX = 32, offsetY = 120
		expect(
			resolveRestoredPreviewPlacement(
				{ offsetX: 10, offsetY: 10, visible: false },
				{ width: 0, height: 0 },
				0,
			),
		).toEqual({ offsetX: 32, offsetY: 120, visible: false });
	});
});

describe("resolveViewportConstrainedPreview", () => {
	it("keeps default size and placement on a normal large screen", () => {
		const result = resolveViewportConstrainedPreview({
			size: 208,
			placement: { offsetX: 0, offsetY: 0, visible: true },
			viewport: { width: 1440, height: 900 },
		});
		expect(result).toEqual({
			size: 208,
			placement: { offsetX: 0, offsetY: 0, visible: true },
		});
	});

	it("shrinks and re-clamps when restoring into a smaller viewport", () => {
		const viewport = { width: 200, height: 180 };
		const result = resolveViewportConstrainedPreview({
			size: 320,
			placement: { offsetX: -40, offsetY: 80, visible: true },
			viewport,
		});
		expect(result.size).toBe(180);
		const rect = absolutePreviewRect(viewport, result.size, result.placement);
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.right).toBeLessThanOrEqual(viewport.width);
		expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
		expect(result.placement.visible).toBe(true);
	});

	it("handles viewport resize so the full square remains visible", () => {
		const large = resolveViewportConstrainedPreview({
			size: 288,
			placement: { offsetX: 20, offsetY: -30, visible: true },
			viewport: { width: 1280, height: 800 },
		});
		expect(large.size).toBe(288);

		const shrunkViewport = { width: 160, height: 120 };
		const afterResize = resolveViewportConstrainedPreview({
			size: large.size,
			placement: large.placement,
			viewport: shrunkViewport,
		});
		expect(afterResize.size).toBe(120);
		const rect = absolutePreviewRect(shrunkViewport, afterResize.size, afterResize.placement);
		expect(rect.left).toBeGreaterThanOrEqual(0);
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.right).toBeLessThanOrEqual(shrunkViewport.width);
		expect(rect.bottom).toBeLessThanOrEqual(shrunkViewport.height);
	});

	it("never returns a negative size on tiny viewports", () => {
		const result = resolveViewportConstrainedPreview({
			size: 208,
			placement: { offsetX: 0, offsetY: 0, visible: true },
			viewport: { width: 0, height: 50 },
		});
		expect(result.size).toBe(0);
		expect(result.placement.visible).toBe(true);
	});
});
