import { describe, expect, it } from "vitest";
import {
	applySessionWebcamAppearance,
	createWebcamAutoDirectorController,
	getAutoDirectedWebcamLayout,
	getCropMatchedWebcamHeightPercent,
	getWebcamCropSourceRect,
	getWebcamOverlayDimensionsPx,
	getWebcamOverlayPosition,
	isWebcamCropRegionDefault,
	normalizeWebcamCropRegion,
} from "./webcamOverlay";

describe("getAutoDirectedWebcamLayout", () => {
	it("keeps the chosen layout while the screen is not zoomed", () => {
		expect(
			getAutoDirectedWebcamLayout({
				enabled: true,
				zoomScale: 1,
				focusX: 0.2,
				focusY: 0.2,
				positionPreset: "bottom-right",
				positionX: 1,
				positionY: 1,
				widthPercent: 40,
				heightPercent: 40,
			}),
		).toMatchObject({ positionX: 1, positionY: 1, widthPercent: 40, heightPercent: 40 });
	});

	it("moves opposite the active zoom focus and shrinks the camera", () => {
		const layout = getAutoDirectedWebcamLayout({
			enabled: true,
			zoomScale: 2,
			focusX: 0.15,
			focusY: 0.2,
			positionPreset: "top-left",
			positionX: 0,
			positionY: 0,
			widthPercent: 40,
			heightPercent: 40,
		});
		expect(layout.positionPreset).toBe("custom");
		expect(layout.positionX).toBe(1);
		expect(layout.positionY).toBe(1);
		expect(layout.widthPercent).toBeLessThan(40);
	});

	it("uses the nearest single-axis dodge and slightly zooms out", () => {
		const layout = getAutoDirectedWebcamLayout({
			enabled: true,
			zoomScale: 1,
			focusX: 0.5,
			focusY: 0.5,
			cursorX: 0.92,
			cursorY: 0.9,
			containerWidth: 1920,
			containerHeight: 1080,
			positionPreset: "bottom-right",
			positionX: 1,
			positionY: 1,
			widthPercent: 40,
			heightPercent: 40,
		});

		expect(layout).toMatchObject({
			positionPreset: "custom",
			positionX: 0,
			positionY: 1,
		});
		expect(layout.widthPercent).toBeCloseTo(35.2);
		expect(layout.heightPercent).toBeCloseTo(35.2);
	});

	it("falls back to the farthest diagonal when no flipped candidate clears", () => {
		const layout = getAutoDirectedWebcamLayout({
			enabled: true,
			zoomScale: 1,
			focusX: 0.5,
			focusY: 0.5,
			cursorX: 0.5,
			cursorY: 0.5,
			containerWidth: 1920,
			containerHeight: 1080,
			positionPreset: "custom",
			positionX: 0.5,
			positionY: 0.5,
			widthPercent: 40,
			heightPercent: 40,
		});

		expect(layout).toMatchObject({ positionX: 0, positionY: 0 });
	});

	it("prefers the shortest cleared axis", () => {
		const layout = getAutoDirectedWebcamLayout({
			enabled: true,
			zoomScale: 1,
			focusX: 0.5,
			focusY: 0.5,
			cursorX: 0.2,
			cursorY: 0.75,
			containerWidth: 1920,
			containerHeight: 1080,
			positionPreset: "custom",
			positionX: 0.1,
			positionY: 0.8,
			widthPercent: 40,
			heightPercent: 40,
		});

		expect(layout.positionX).toBeCloseTo(0.1);
		expect(layout.positionY).toBeCloseTo(0.2);
	});

	it("does not move when the cursor is safely outside the webcam", () => {
		const layout = getAutoDirectedWebcamLayout({
			enabled: true,
			zoomScale: 1,
			focusX: 0.5,
			focusY: 0.5,
			cursorX: 0.1,
			cursorY: 0.1,
			containerWidth: 1920,
			containerHeight: 1080,
			positionPreset: "bottom-right",
			positionX: 1,
			positionY: 1,
			widthPercent: 40,
			heightPercent: 40,
		});

		expect(layout).toMatchObject({
			positionX: 1,
			positionY: 1,
			widthPercent: 40,
			heightPercent: 40,
		});
	});
});

const controllerInput = {
	enabled: true,
	zoomScale: 1,
	focusX: 0.5,
	focusY: 0.5,
	containerWidth: 1920,
	containerHeight: 1080,
	positionPreset: "bottom-right" as const,
	positionX: 1,
	positionY: 1,
	widthPercent: 40,
	heightPercent: 40,
};

describe("createWebcamAutoDirectorController", () => {
	it("waits for a continuous 200ms collision before dodging", () => {
		const controller = createWebcamAutoDirectorController();
		const collidingCursor = { cursorX: 0.92, cursorY: 0.9 };

		expect(
			controller.direct({ ...controllerInput, ...collidingCursor, timeMs: 0 }),
		).toMatchObject({
			positionX: 1,
			positionY: 1,
		});
		expect(
			controller.direct({ ...controllerInput, ...collidingCursor, timeMs: 100 }),
		).toMatchObject({ positionX: 1, positionY: 1 });
		expect(
			controller.direct({ ...controllerInput, ...collidingCursor, timeMs: 250 }),
		).toMatchObject({ positionX: 0, positionY: 1 });
	});

	it("does not dodge when the cursor passes through in under 200ms", () => {
		const controller = createWebcamAutoDirectorController();

		controller.direct({ ...controllerInput, cursorX: 0.92, cursorY: 0.9, timeMs: 0 });
		expect(
			controller.direct({ ...controllerInput, cursorX: 0.1, cursorY: 0.1, timeMs: 150 }),
		).toMatchObject({ positionX: 1, positionY: 1, widthPercent: 40 });
		expect(
			controller.direct({ ...controllerInput, cursorX: 0.92, cursorY: 0.9, timeMs: 250 }),
		).toMatchObject({ positionX: 1, positionY: 1, widthPercent: 40 });
	});

	it("holds the dodge for 1200ms after the cursor clears", () => {
		const controller = createWebcamAutoDirectorController();
		const collidingCursor = { cursorX: 0.92, cursorY: 0.9 };
		const clearCursor = { cursorX: 0.1, cursorY: 0.1 };

		controller.direct({ ...controllerInput, ...collidingCursor, timeMs: 0 });
		controller.direct({ ...controllerInput, ...collidingCursor, timeMs: 250 });
		expect(
			controller.direct({ ...controllerInput, ...clearCursor, timeMs: 300 }),
		).toMatchObject({
			positionX: 0,
			positionY: 1,
		});
		expect(
			controller.direct({ ...controllerInput, ...clearCursor, timeMs: 1499 }),
		).toMatchObject({
			positionX: 0,
			positionY: 1,
		});
		expect(
			controller.direct({ ...controllerInput, ...clearCursor, timeMs: 1500 }),
		).toMatchObject({
			positionX: 1,
			positionY: 1,
		});
	});

	it("re-dodges after the cursor dwells on the current dodge position", () => {
		const controller = createWebcamAutoDirectorController();

		controller.direct({ ...controllerInput, cursorX: 0.92, cursorY: 0.9, timeMs: 0 });
		controller.direct({ ...controllerInput, cursorX: 0.92, cursorY: 0.9, timeMs: 250 });
		expect(
			controller.direct({ ...controllerInput, cursorX: 0.08, cursorY: 0.9, timeMs: 300 }),
		).toMatchObject({ positionX: 0, positionY: 1 });
		expect(
			controller.direct({ ...controllerInput, cursorX: 0.08, cursorY: 0.9, timeMs: 550 }),
		).toMatchObject({ positionX: 1, positionY: 1 });
	});

	it("resets dwell and dodge state after a backward seek", () => {
		const controller = createWebcamAutoDirectorController();
		const collidingCursor = { cursorX: 0.92, cursorY: 0.9 };

		controller.direct({ ...controllerInput, ...collidingCursor, timeMs: 0 });
		expect(
			controller.direct({ ...controllerInput, ...collidingCursor, timeMs: 250 }),
		).toMatchObject({ positionX: 0, positionY: 1 });
		expect(
			controller.direct({ ...controllerInput, ...collidingCursor, timeMs: -300 }),
		).toMatchObject({ positionX: 1, positionY: 1, widthPercent: 40 });
	});
});

describe("normalizeWebcamCropRegion", () => {
	it("defaults to the full webcam frame", () => {
		expect(normalizeWebcamCropRegion()).toEqual({ x: 0, y: 0, width: 1, height: 1 });
		expect(isWebcamCropRegionDefault()).toBe(true);
	});

	it("clamps crop dimensions inside the source frame", () => {
		const crop = normalizeWebcamCropRegion({ x: 0.8, y: -1, width: 0.5, height: 2 });
		expect(crop.x).toBe(0.8);
		expect(crop.y).toBe(0);
		expect(crop.width).toBeCloseTo(0.2);
		expect(crop.height).toBe(1);
	});
});

describe("applySessionWebcamAppearance", () => {
	it("returns an empty patch when appearance is missing", () => {
		expect(applySessionWebcamAppearance(null)).toEqual({});
		expect(applySessionWebcamAppearance(undefined)).toEqual({});
	});

	it("normalizes out-of-range crop regions", () => {
		expect(
			applySessionWebcamAppearance({
				cropRegion: { x: 0.8, y: -1, width: 0.5, height: 2 },
			}),
		).toEqual({
			cropRegion: normalizeWebcamCropRegion({ x: 0.8, y: -1, width: 0.5, height: 2 }),
		});
	});

	it("passes through mirror when it is a boolean", () => {
		expect(applySessionWebcamAppearance({ mirror: false })).toEqual({ mirror: false });
		expect(applySessionWebcamAppearance({ mirror: true })).toEqual({ mirror: true });
	});

	it("applies both crop and mirror when present", () => {
		expect(
			applySessionWebcamAppearance({
				cropRegion: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
				mirror: false,
			}),
		).toEqual({
			cropRegion: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
			mirror: false,
		});
	});
});

describe("getWebcamOverlayDimensionsPx", () => {
	it("resolves independent width and height percentages", () => {
		expect(
			getWebcamOverlayDimensionsPx({
				containerWidth: 1000,
				containerHeight: 800,
				widthPercent: 50,
				heightPercent: 25,
				margin: 0,
				zoomScale: 1,
				reactToZoom: false,
			}),
		).toEqual({
			width: 400,
			height: 200,
		});
	});
});

describe("getWebcamOverlayPosition", () => {
	it("uses rectangular dimensions when anchoring to a preset", () => {
		expect(
			getWebcamOverlayPosition({
				containerWidth: 1000,
				containerHeight: 800,
				width: 400,
				height: 200,
				margin: 20,
				positionPreset: "bottom-right",
				positionX: 1,
				positionY: 1,
				legacyCorner: "bottom-right",
			}),
		).toEqual({ x: 580, y: 580 });
	});
});

describe("getCropMatchedWebcamHeightPercent", () => {
	it("matches height to a non-default crop aspect when width and height are linked", () => {
		expect(
			getCropMatchedWebcamHeightPercent(60, 60, 1920, 1080, {
				x: 0.1,
				y: 0.2,
				width: 0.6,
				height: 0.4,
			}),
		).toBeCloseTo(22.5);
	});

	it("preserves manually separated width and height controls", () => {
		expect(
			getCropMatchedWebcamHeightPercent(60, 45, 1920, 1080, {
				x: 0.1,
				y: 0.2,
				width: 0.6,
				height: 0.4,
			}),
		).toBe(45);
	});

	it("keeps the default crop square-compatible", () => {
		expect(getCropMatchedWebcamHeightPercent(60, 60, 1920, 1080, undefined)).toBe(60);
	});
});

describe("getWebcamCropSourceRect", () => {
	it("converts normalized crop settings to source pixels", () => {
		expect(
			getWebcamCropSourceRect({ x: 0.25, y: 0.1, width: 0.5, height: 0.75 }, 1920, 1080),
		).toEqual({
			sx: 480,
			sy: 108,
			sw: 960,
			sh: 810,
		});
	});
});
