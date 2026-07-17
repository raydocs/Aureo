import { describe, expect, it } from "vitest";
import {
	computeResizeCornerInset,
	computeResizedPreviewBox,
	type WebcamResizeCorner,
} from "./webcamPreviewResize";

const VIEWPORT = { width: 1000, height: 1000 };

function resize(
	overrides: Partial<Parameters<typeof computeResizedPreviewBox>[0]> = {},
): ReturnType<typeof computeResizedPreviewBox> {
	return computeResizedPreviewBox({
		corner: "top-left",
		startSize: 200,
		startOffset: { x: 0, y: 0 },
		delta: { x: 0, y: 0 },
		centerScale: false,
		quantize: false,
		snapSizes: [],
		viewport: VIEWPORT,
		...overrides,
	});
}

describe("computeResizedPreviewBox", () => {
	it.each<{
		corner: WebcamResizeCorner;
		outward: { x: number; y: number };
		offset: { x: number; y: number };
	}>([
		{ corner: "top-left", outward: { x: -20, y: -20 }, offset: { x: 0, y: 0 } },
		{ corner: "top-right", outward: { x: 20, y: -20 }, offset: { x: 20, y: 0 } },
		{ corner: "bottom-left", outward: { x: -20, y: 20 }, offset: { x: 0, y: 20 } },
		{ corner: "bottom-right", outward: { x: 20, y: 20 }, offset: { x: 20, y: 20 } },
	])("grows $corner outward and compensates its offset", ({ corner, outward, offset }) => {
		expect(resize({ corner, delta: outward })).toEqual({ size: 220, offset, snappedTo: null });
		expect(resize({ corner, delta: { x: -outward.x, y: -outward.y } }).size).toBe(180);
	});

	it("doubles the size delta around the center and compensates both offset axes", () => {
		expect(
			resize({
				corner: "top-left",
				delta: { x: -10, y: -10 },
				centerScale: true,
			}),
		).toEqual({ size: 220, offset: { x: 10, y: 10 }, snappedTo: null });
	});

	it("quantizes to the 8px grid", () => {
		expect(resize({ delta: { x: -5, y: -5 }, quantize: true }).size).toBe(208);
	});

	it("lets a snap within tolerance win over quantization", () => {
		expect(resize({ delta: { x: -13, y: -13 }, quantize: true, snapSizes: [210] })).toEqual({
			size: 210,
			offset: { x: 0, y: 0 },
			snappedTo: 210,
		});
	});

	it("does not snap outside tolerance", () => {
		expect(resize({ delta: { x: -13, y: -13 }, quantize: true, snapSizes: [208] })).toEqual({
			size: 216,
			offset: { x: 0, y: 0 },
			snappedTo: null,
		});
	});

	it("clamps to both ends of the allowed size range", () => {
		expect(resize({ delta: { x: 200, y: 200 } }).size).toBe(144);
		expect(resize({ delta: { x: -400, y: -400 } }).size).toBe(320);
	});

	it.each<{
		corner: WebcamResizeCorner;
		viewport: { width: number; height: number };
		startOffset: { x: number; y: number };
		expected: ReturnType<typeof computeResizedPreviewBox>;
	}>([
		{
			corner: "top-left",
			viewport: { width: 400, height: 400 },
			startOffset: { x: 0, y: 0 },
			expected: { size: 280, offset: { x: 0, y: 0 }, snappedTo: null },
		},
		{
			corner: "bottom-right",
			viewport: { width: 500, height: 500 },
			startOffset: { x: 0, y: 0 },
			expected: { size: 232, offset: { x: 32, y: 32 }, snappedTo: null },
		},
		{
			corner: "top-right",
			viewport: { width: 500, height: 500 },
			startOffset: { x: 0, y: 0 },
			expected: { size: 232, offset: { x: 32, y: 0 }, snappedTo: null },
		},
		{
			corner: "bottom-left",
			viewport: { width: 500, height: 500 },
			startOffset: { x: 0, y: 90 },
			expected: { size: 230, offset: { x: 0, y: 120 }, snappedTo: null },
		},
	])("clamps $corner against its fixed point", ({ corner, viewport, startOffset, expected }) => {
		expect(
			resize({
				corner,
				viewport,
				startOffset,
				delta: {
					x: corner.includes("left") ? -200 : 200,
					y: corner.includes("top") ? -200 : 200,
				},
			}),
		).toEqual(expected);
	});

	it("clamps center scaling around the fixed center", () => {
		expect(
			resize({
				viewport: { width: 500, height: 500 },
				delta: { x: -50, y: -50 },
				centerScale: true,
			}),
		).toEqual({ size: 264, offset: { x: 32, y: 32 }, snappedTo: null });
	});

	it("clears snappedTo when viewport clamping moves off the snapped size", () => {
		expect(
			resize({
				viewport: { width: 400, height: 400 },
				delta: { x: -88, y: -88 },
				snapSizes: [288],
			}),
		).toEqual({ size: 280, offset: { x: 0, y: 0 }, snappedTo: null });
	});

	it("returns range-clamped start values for a degenerate viewport", () => {
		const startOffset = { x: 3.25, y: -7.5 };
		expect(
			resize({
				startSize: 400,
				startOffset,
				viewport: { width: 0, height: 500 },
				delta: { x: -100, y: -100 },
			}),
		).toEqual({ size: 320, offset: startOffset, snappedTo: null });
	});

	it("returns start values for a non-finite delta", () => {
		const startOffset = { x: 3.25, y: -7.5 };
		expect(resize({ startOffset, delta: { x: Number.NaN, y: 10 } })).toEqual({
			size: 200,
			offset: startOffset,
			snappedTo: null,
		});
	});
});

describe("computeResizeCornerInset", () => {
	it("returns zero for square corners", () => {
		expect(computeResizeCornerInset(208, 0)).toBe(0);
	});

	it("places a fully rounded 208px preview on its visual corner", () => {
		expect(computeResizeCornerInset(208, 100)).toBeCloseTo(208 * 0.5 * (1 - Math.SQRT1_2));
	});

	it("guards negative and non-finite inputs", () => {
		expect(computeResizeCornerInset(-1, 100)).toBe(0);
		expect(computeResizeCornerInset(208, -1)).toBe(0);
		expect(computeResizeCornerInset(Number.NaN, 100)).toBe(0);
		expect(computeResizeCornerInset(208, Number.NaN)).toBe(0);
	});
});
