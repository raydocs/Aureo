import { describe, expect, it } from "vitest";
import {
	buildAreaSelectedSource,
	createAreaCaptureLayout,
	getVirtualDesktopBounds,
	intersectCaptureRects,
	isValidAreaSelection,
	normalizeCaptureRect,
	windowLocalRectToGlobal,
} from "./areaGeometry";

describe("area capture geometry", () => {
	it("normalizes a reverse drag", () => {
		expect(normalizeCaptureRect(900, 700, 100, 200)).toEqual({
			x: 100,
			y: 200,
			width: 800,
			height: 500,
		});
	});

	it("returns the overlap between rectangles", () => {
		expect(
			intersectCaptureRects(
				{ x: -200, y: 100, width: 500, height: 400 },
				{ x: 0, y: 0, width: 500, height: 300 },
			),
		).toEqual({ x: 0, y: 100, width: 300, height: 200 });
	});

	it("splits a cross-display selection and preserves its global layout", () => {
		const layout = createAreaCaptureLayout({ x: 800, y: 100, width: 600, height: 500 }, [
			{
				id: "1",
				bounds: { x: 0, y: 0, width: 1000, height: 800 },
				scaleFactor: 2,
			},
			{
				id: "2",
				bounds: { x: 1000, y: 0, width: 1000, height: 800 },
				scaleFactor: 1,
			},
		]);

		expect(layout).toEqual({
			selection: { x: 800, y: 100, width: 600, height: 500 },
			outputScaleFactor: 2,
			outputSize: { width: 1200, height: 1000 },
			segments: [
				{
					displayId: "1",
					displayScaleFactor: 2,
					sourceRect: { x: 800, y: 100, width: 200, height: 500 },
					outputRect: { x: 0, y: 0, width: 400, height: 1000 },
					captureSize: { width: 400, height: 1000 },
				},
				{
					displayId: "2",
					displayScaleFactor: 1,
					sourceRect: { x: 0, y: 100, width: 400, height: 500 },
					outputRect: { x: 400, y: 0, width: 800, height: 1000 },
					captureSize: { width: 400, height: 500 },
				},
			],
		});
	});

	it("supports displays with negative desktop coordinates", () => {
		const layout = createAreaCaptureLayout({ x: -300, y: -100, width: 200, height: 150 }, [
			{
				id: "left",
				bounds: { x: -1440, y: -900, width: 1440, height: 900 },
				scaleFactor: 1,
			},
		]);

		expect(layout?.segments[0]?.sourceRect).toEqual({
			x: 1140,
			y: 800,
			width: 200,
			height: 100,
		});
		expect(layout?.outputSize).toEqual({ width: 200, height: 150 });
	});

	it("rejects empty or off-desktop selections", () => {
		expect(createAreaCaptureLayout({ x: 0, y: 0, width: 0, height: 20 }, [])).toBeNull();
		expect(
			createAreaCaptureLayout({ x: 2000, y: 2000, width: 100, height: 100 }, [
				{ id: "1", bounds: { x: 0, y: 0, width: 1000, height: 800 }, scaleFactor: 2 },
			]),
		).toBeNull();
	});

	it("computes virtual desktop bounds across negative display origins", () => {
		expect(
			getVirtualDesktopBounds([
				{
					id: "left",
					bounds: { x: -1440, y: -200, width: 1440, height: 900 },
					scaleFactor: 1,
				},
				{
					id: "primary",
					bounds: { x: 0, y: 0, width: 1920, height: 1080 },
					scaleFactor: 2,
				},
			]),
		).toEqual({ x: -1440, y: -200, width: 3360, height: 1280 });
	});

	it("maps overlay-local rects into global DIP, including negatives", () => {
		expect(
			windowLocalRectToGlobal(
				{ x: -1440, y: -200, width: 3360, height: 1280 },
				{ x: 100, y: 50, width: 400, height: 300 },
			),
		).toEqual({ x: -1340, y: -150, width: 400, height: 300 });
	});

	it("validates minimum area size and builds a first-class area source", () => {
		expect(isValidAreaSelection({ x: 0, y: 0, width: 1, height: 20 })).toBe(false);
		expect(isValidAreaSelection({ x: -10, y: 4, width: 20, height: 30 })).toBe(true);

		const layout = createAreaCaptureLayout({ x: 10, y: 20, width: 100, height: 80 }, [
			{ id: "1", bounds: { x: 0, y: 0, width: 1000, height: 800 }, scaleFactor: 2 },
		]);
		expect(layout).not.toBeNull();
		expect(buildAreaSelectedSource(layout!)).toMatchObject({
			id: "area:10,20,100x80",
			name: "Area 100×80",
			display_id: "1",
			sourceType: "area",
			geometry: layout,
			thumbnail: null,
			appIcon: null,
		});
	});
});
