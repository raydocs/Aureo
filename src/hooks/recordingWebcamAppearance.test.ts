import { describe, expect, it } from "vitest";
import { DEFAULT_WEBCAM_PREVIEW_APPEARANCE } from "@/components/launch/webcamPreviewAppearance";
import { buildRecordingWebcamAppearance } from "./recordingWebcamAppearance";

const EPS = 1e-6;
const TRACK_1280x720 = { width: 1280, height: 720 };

describe("buildRecordingWebcamAppearance", () => {
	it("default appearance + 1280×720 crops to centered 9/16 fill region", () => {
		const snap = buildRecordingWebcamAppearance(
			DEFAULT_WEBCAM_PREVIEW_APPEARANCE,
			TRACK_1280x720,
		);
		const expectedW = 9 / 16;

		expect(snap.cropRegion.width).toBeCloseTo(expectedW, 6);
		expect(snap.cropRegion.height).toBeCloseTo(1, 6);
		expect(snap.cropRegion.x).toBeCloseTo((1 - expectedW) / 2, 6);
		expect(snap.cropRegion.y).toBeCloseTo(0, 6);
		expect(snap.mirror).toBe(DEFAULT_WEBCAM_PREVIEW_APPEARANCE.mirror);
	});

	it("zoom 1.25 + centerX 0.8 yields an offset crop still within [0,1]", () => {
		const snap = buildRecordingWebcamAppearance(
			{ ...DEFAULT_WEBCAM_PREVIEW_APPEARANCE, zoom: 1.25, centerX: 0.8 },
			TRACK_1280x720,
		);

		expect(snap.cropRegion.x).toBeGreaterThanOrEqual(0);
		expect(snap.cropRegion.x + snap.cropRegion.width).toBeLessThanOrEqual(1 + EPS);
		// Offset from the default centered crop
		expect(snap.cropRegion.x).not.toBeCloseTo((1 - 9 / 16) / 2, 3);
	});

	it("missing or zero track settings match explicit 16/9", () => {
		const withExplicit = buildRecordingWebcamAppearance(DEFAULT_WEBCAM_PREVIEW_APPEARANCE, {
			width: 16,
			height: 9,
		});
		const withMissing = buildRecordingWebcamAppearance(
			DEFAULT_WEBCAM_PREVIEW_APPEARANCE,
			undefined,
		);
		const withZero = buildRecordingWebcamAppearance(DEFAULT_WEBCAM_PREVIEW_APPEARANCE, {
			width: 0,
			height: 0,
		});

		expect(withMissing).toEqual(withExplicit);
		expect(withZero).toEqual(withExplicit);
	});

	it("mirror passthrough both ways", () => {
		expect(
			buildRecordingWebcamAppearance(
				{ ...DEFAULT_WEBCAM_PREVIEW_APPEARANCE, mirror: true },
				TRACK_1280x720,
			).mirror,
		).toBe(true);
		expect(
			buildRecordingWebcamAppearance(
				{ ...DEFAULT_WEBCAM_PREVIEW_APPEARANCE, mirror: false },
				TRACK_1280x720,
			).mirror,
		).toBe(false);
	});
});
