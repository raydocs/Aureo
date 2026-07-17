import { describe, expect, it } from "vitest";
import { normalizeWebcamCropRegion } from "@/components/video-editor/webcamOverlay";
import {
	applyWebcamFramingDrag,
	computeWebcamFramingLayout,
	type WebcamFramingInput,
} from "./webcamPreviewFraming";

const CONTAINER = { width: 208, height: 208 };
const ASPECT_16_9 = 16 / 9;
const EPS = 1e-6;

function baseInput(overrides: Partial<WebcamFramingInput> = {}): WebcamFramingInput {
	return {
		zoom: 1,
		fitMode: "fill",
		centerX: 0.5,
		centerY: 0.5,
		mirror: true,
		...overrides,
	};
}

describe("computeWebcamFramingLayout", () => {
	it("fill zoom 1 at 16/9 fills height and crops sides", () => {
		const layout = computeWebcamFramingLayout(baseInput(), CONTAINER, ASPECT_16_9);
		const expectedDw = 208 * (16 / 9);

		expect(layout.video.height).toBeCloseTo(208, 6);
		expect(layout.video.width).toBeCloseTo(expectedDw, 6);
		// Centered / clamped on X: left = (Wc - dw) / 2 conceptually, but dw > Wc so clamped
		expect(layout.video.left).toBeCloseTo((208 - expectedDw) / 2, 6);
		expect(layout.video.top).toBeCloseTo(0, 6);
		expect(layout.showBackdrop).toBe(false);
		expect(layout.pannableX).toBe(true);
		expect(layout.pannableY).toBe(true);

		const expectedCropW = 9 / 16;
		expect(layout.cropRegion.width).toBeCloseTo(expectedCropW, 6);
		expect(layout.cropRegion.height).toBeCloseTo(1, 6);
		expect(layout.cropRegion.x).toBeCloseTo((1 - expectedCropW) / 2, 6);
		expect(layout.cropRegion.y).toBeCloseTo(0, 6);
		expect(Math.abs(layout.cropRegion.x - (1 - 9 / 16) / 2)).toBeLessThan(EPS);
	});

	it("clamps extreme centerX so no empty edge is exposed", () => {
		// mirror false: high centerX drives left toward Wc−dw (the far edge clamp)
		const layout = computeWebcamFramingLayout(
			baseInput({ zoom: 1.25, centerX: 0.9, mirror: false }),
			CONTAINER,
			ASPECT_16_9,
		);
		const dw = layout.video.width;
		const Wc = CONTAINER.width;

		expect(layout.video.left).toBeCloseTo(Wc - dw, 6);
		expect(layout.clampedCenter.x).toBeLessThan(0.9);
		expect(layout.cropRegion.x + layout.cropRegion.width).toBeLessThanOrEqual(1 + EPS);
	});

	it("mirror reflects left but never changes cropRegion x", () => {
		const mirrored = computeWebcamFramingLayout(
			baseInput({ centerX: 0.3, mirror: true }),
			CONTAINER,
			ASPECT_16_9,
		);
		const unmirrored = computeWebcamFramingLayout(
			baseInput({ centerX: 0.3, mirror: false }),
			CONTAINER,
			ASPECT_16_9,
		);

		// lefts are reflections of each other around the container center
		const mid = CONTAINER.width / 2;
		const mirroredCenter = mirrored.video.left + mirrored.video.width / 2;
		const unmirroredCenter = unmirrored.video.left + unmirrored.video.width / 2;
		expect(mirroredCenter).toBeCloseTo(2 * mid - unmirroredCenter, 6);

		expect(mirrored.cropRegion.x).toBeCloseTo(unmirrored.cropRegion.x, 6);
		expect(mirrored.cropRegion).toEqual(unmirrored.cropRegion);
	});

	it("fill zoom 0.8 letterboxes Y and ignores centerY", () => {
		const layout = computeWebcamFramingLayout(
			baseInput({ zoom: 0.8, centerY: 0.9 }),
			CONTAINER,
			ASPECT_16_9,
		);

		expect(layout.video.height).toBeLessThan(CONTAINER.height);
		expect(layout.video.top).toBeCloseTo((CONTAINER.height - layout.video.height) / 2, 6);
		expect(layout.showBackdrop).toBe(true);
		expect(layout.pannableY).toBe(false);
		expect(layout.clampedCenter.y).toBe(0.9); // input passed through on letterboxed axis
		expect(layout.cropRegion.height).toBeCloseTo(1, 6);
		expect(layout.cropRegion.y).toBeCloseTo(0, 6);
	});

	it("fit zoom 1 contains the full frame with letterboxing", () => {
		const layout = computeWebcamFramingLayout(
			baseInput({ fitMode: "fit", zoom: 1 }),
			CONTAINER,
			ASPECT_16_9,
		);

		expect(layout.video.width).toBeCloseTo(CONTAINER.width, 6);
		expect(layout.video.height).toBeCloseTo(CONTAINER.width * (9 / 16), 6);
		expect(layout.showBackdrop).toBe(true);
		expect(layout.cropRegion).toEqual({ x: 0, y: 0, width: 1, height: 1 });
	});

	it("falls back to 16/9 for degenerate aspects and letterboxes portrait correctly", () => {
		const fromZero = computeWebcamFramingLayout(baseInput(), CONTAINER, 0);
		const fromNaN = computeWebcamFramingLayout(baseInput(), CONTAINER, Number.NaN);
		const fromNeg = computeWebcamFramingLayout(baseInput(), CONTAINER, -2);
		const from16x9 = computeWebcamFramingLayout(baseInput(), CONTAINER, ASPECT_16_9);

		expect(fromZero.video.width).toBeCloseTo(from16x9.video.width, 6);
		expect(fromNaN.video.height).toBeCloseTo(from16x9.video.height, 6);
		expect(fromNeg.cropRegion).toEqual(from16x9.cropRegion);

		// Portrait 9/16: fill covers width, letterboxes height? Actually cover takes max scale.
		// vw=9/16, vh=1: coverScale = max(Wc/(9/16), Hc/1) = max(Wc*16/9, Hc) = max larger = Wc*16/9
		// so dw = Wc, dh = Hc * (16/9) wait:
		// s = max(Wc/vw, Hc) = max(208/(9/16), 208) = max(208*16/9, 208) = 208*16/9
		// dw = (9/16)*s = 208, dh = s = 208*16/9 > Hc → pannable Y, crop height < 1
		const portrait = computeWebcamFramingLayout(baseInput(), CONTAINER, 9 / 16);
		expect(portrait.video.width).toBeCloseTo(CONTAINER.width, 6);
		expect(portrait.video.height).toBeGreaterThan(CONTAINER.height);
		expect(portrait.pannableX).toBe(true);
		expect(portrait.pannableY).toBe(true);
		// Swapped letterbox axis vs landscape fill: landscape crops X; portrait crops Y
		expect(portrait.cropRegion.width).toBeCloseTo(1, 6);
		expect(portrait.cropRegion.height).toBeCloseTo(9 / 16, 6);
	});

	it("round-trips cropRegion through normalizeWebcamCropRegion", () => {
		const fitModes = ["fill", "fit"] as const;
		const zooms = [0.8, 1, 1.25, 1.5];
		const centers = [0, 0.3, 0.5, 0.9];

		for (const fitMode of fitModes) {
			for (const zoom of zooms) {
				for (const centerX of centers) {
					for (const centerY of centers) {
						const layout = computeWebcamFramingLayout(
							baseInput({ fitMode, zoom, centerX, centerY, mirror: true }),
							CONTAINER,
							ASPECT_16_9,
						);
						const normalized = normalizeWebcamCropRegion(layout.cropRegion);
						expect(normalized.x).toBeCloseTo(layout.cropRegion.x, 3);
						expect(normalized.y).toBeCloseTo(layout.cropRegion.y, 3);
						expect(normalized.width).toBeCloseTo(layout.cropRegion.width, 3);
						expect(normalized.height).toBeCloseTo(layout.cropRegion.height, 3);
					}
				}
			}
		}
	});
});

describe("applyWebcamFramingDrag", () => {
	it("inverts X sign based on mirror and always uses −Y for deltaY", () => {
		const inputMirrored = baseInput({ zoom: 1.5, centerX: 0.5, centerY: 0.5, mirror: true });
		const inputUnmirrored = { ...inputMirrored, mirror: false };
		const layoutM = computeWebcamFramingLayout(inputMirrored, CONTAINER, ASPECT_16_9);
		const layoutU = computeWebcamFramingLayout(inputUnmirrored, CONTAINER, ASPECT_16_9);

		const delta = { x: 20, y: 10 };
		const draggedM = applyWebcamFramingDrag(layoutM, delta, inputMirrored);
		const draggedU = applyWebcamFramingDrag(layoutU, delta, inputUnmirrored);

		// Mirrored: +deltaX moves centerX up; unmirrored: −deltaX
		expect(draggedM.centerX).toBeGreaterThan(0.5);
		expect(draggedU.centerX).toBeLessThan(0.5);
		// Both decrease centerY for positive deltaY
		expect(draggedM.centerY).toBeLessThan(0.5);
		expect(draggedU.centerY).toBeLessThan(0.5);
	});

	it("gates deltas per-axis when letterboxed", () => {
		// fill zoom 0.8: Y letterboxed (not pannable), X still pannable
		const input = baseInput({ zoom: 0.8, centerX: 0.5, centerY: 0.7, mirror: false });
		const layout = computeWebcamFramingLayout(input, CONTAINER, ASPECT_16_9);
		expect(layout.pannableX).toBe(true);
		expect(layout.pannableY).toBe(false);

		const next = applyWebcamFramingDrag(layout, { x: -30, y: 40 }, input);
		expect(next.centerX).not.toBe(0.5);
		expect(next.centerY).toBe(0.7); // letterboxed Y unchanged
	});

	it("clamps drag so crop cannot leave the source", () => {
		const input = baseInput({ zoom: 1.5, centerX: 0.9, centerY: 0.5, mirror: false });
		const layout = computeWebcamFramingLayout(input, CONTAINER, ASPECT_16_9);
		// Drag far "right" in unmirrored coords (−delta for unmirrored means +center → toward edge)
		// With mirror false: ΔcenterX = −deltaPx.x / dw. To push center higher, drag left (negative x).
		const next = applyWebcamFramingDrag(layout, { x: -10000, y: 0 }, input);
		const nextLayout = computeWebcamFramingLayout(
			{ ...input, centerX: next.centerX, centerY: next.centerY },
			CONTAINER,
			ASPECT_16_9,
		);
		expect(nextLayout.cropRegion.x + nextLayout.cropRegion.width).toBeLessThanOrEqual(1 + EPS);
		expect(nextLayout.cropRegion.x).toBeGreaterThanOrEqual(-EPS);
	});
});
