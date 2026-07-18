import { describe, expect, it } from "vitest";
import type { AreaCaptureLayout } from "./areaGeometry";
import { buildAreaCompositionArgs, constrainAreaCompositionLayout } from "./macAreaComposition";

const layout: AreaCaptureLayout = {
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
};

describe("native macOS area composition", () => {
	it("constrains the full canvas and every segment with the same scale", () => {
		const constrained = constrainAreaCompositionLayout(layout, 600, 500);
		expect(constrained.outputSize).toEqual({ width: 600, height: 500 });
		expect(constrained.segments.map((segment) => segment.outputRect)).toEqual([
			{ x: 0, y: 0, width: 200, height: 500 },
			{ x: 200, y: 0, width: 400, height: 500 },
		]);
	});

	it("builds one cropped-stream overlay per input on a black canvas", () => {
		const args = buildAreaCompositionArgs({
			inputPaths: ["left.mp4", "right.mp4"],
			layout,
			outputPath: "area.mp4",
			frameRate: 60,
		});
		const filter = args[args.indexOf("-filter_complex") + 1];

		expect(args.slice(0, 4)).toEqual(["-i", "left.mp4", "-i", "right.mp4"]);
		expect(filter).toContain("color=c=black:s=1200x1000:r=60[base0]");
		expect(filter).toContain("[0:v]setpts=PTS-STARTPTS,scale=400:1000");
		expect(filter).toContain("overlay=x=400:y=0:shortest=1:eof_action=endall");
		expect(args).toContain("0:a?");
		expect(args.at(-1)).toBe("area.mp4");
	});

	it("rejects incomplete segment input sets", () => {
		expect(() =>
			buildAreaCompositionArgs({
				inputPaths: ["left.mp4"],
				layout,
				outputPath: "area.mp4",
				frameRate: 30,
			}),
		).toThrow("one input per capture segment");
	});
});
