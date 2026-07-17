import { describe, expect, it } from "vitest";
import { getWebcamPreviewShapeStyle, WEBCAM_SQUIRCLE_SUPERELLIPSE_K } from "./webcamPreviewShape";

describe("getWebcamPreviewShapeStyle", () => {
	it("uses a true circle at roundness 100 with no cornerShape", () => {
		const style = getWebcamPreviewShapeStyle(100);
		expect(style.borderRadius).toBe("50%");
		expect("cornerShape" in style).toBe(false);
	});

	it("uses a square at roundness 0 with no cornerShape", () => {
		const style = getWebcamPreviewShapeStyle(0);
		expect(style.borderRadius).toBe("0%");
		expect("cornerShape" in style).toBe(false);
	});

	it("applies superellipse cornerShape for intermediate roundness", () => {
		const style = getWebcamPreviewShapeStyle(30);
		expect(style.borderRadius).toBe("15%");
		expect((style as Record<string, string>).cornerShape).toBe(
			`superellipse(${WEBCAM_SQUIRCLE_SUPERELLIPSE_K.toFixed(4)})`,
		);
		expect((style as Record<string, string>).cornerShape).toBe("superellipse(2.1699)");
	});

	it("clamps roundness to 0..100", () => {
		expect(getWebcamPreviewShapeStyle(150).borderRadius).toBe("50%");
		expect("cornerShape" in getWebcamPreviewShapeStyle(150)).toBe(false);
		expect(getWebcamPreviewShapeStyle(-5).borderRadius).toBe("0%");
		expect("cornerShape" in getWebcamPreviewShapeStyle(-5)).toBe(false);
	});

	it("treats non-finite roundness as 100", () => {
		const style = getWebcamPreviewShapeStyle(Number.NaN);
		expect(style.borderRadius).toBe("50%");
		expect("cornerShape" in style).toBe(false);
	});
});
