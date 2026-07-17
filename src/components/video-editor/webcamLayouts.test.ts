import { describe, expect, it } from "vitest";
import { getActiveWebcamLayout, getWebcamLayoutModeAtTime } from "./webcamOverlay";

describe("dynamic webcam layouts", () => {
	const layouts = [
		{ id: "layout-1", startMs: 1_000, endMs: 3_000, mode: "fullscreen" as const },
		{ id: "layout-2", startMs: 4_000, endMs: 5_000, mode: "hidden" as const },
	];

	it("uses the default layout outside explicit regions", () => {
		expect(getWebcamLayoutModeAtTime(layouts, 999)).toBe("default");
		expect(getWebcamLayoutModeAtTime(layouts, 3_000)).toBe("default");
	});

	it("resolves fullscreen and hidden regions using end-exclusive bounds", () => {
		expect(getWebcamLayoutModeAtTime(layouts, 1_000)).toBe("fullscreen");
		expect(getWebcamLayoutModeAtTime(layouts, 2_999)).toBe("fullscreen");
		expect(getWebcamLayoutModeAtTime(layouts, 4_500)).toBe("hidden");
	});

	it("prefers the latest-starting region if legacy project data overlaps", () => {
		const overlapping = [
			...layouts,
			{ id: "layout-3", startMs: 2_000, endMs: 2_500, mode: "hidden" as const },
		];
		expect(getActiveWebcamLayout(overlapping, 2_250)?.id).toBe("layout-3");
	});
});
