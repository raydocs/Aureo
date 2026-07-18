import { describe, expect, it } from "vitest";
import { getRegionSurfaceClass, surfaceClass, surfaces } from ".";
import type { TimelineVariant } from "./timelineSurfaceClasses";

describe("timeline presentation surfaces", () => {
	it("exports a class for every region variant", () => {
		const variants: TimelineVariant[] = [
			"clip",
			"zoom",
			"trim",
			"speed",
			"mask",
			"audio",
			"caption",
			"webcam-layout",
			"annotation",
		];
		for (const variant of variants) {
			const cls = getRegionSurfaceClass(variant);
			expect(typeof cls).toBe("string");
			expect(cls.length).toBeGreaterThan(0);
		}
	});

	it("surfaceClass exposes the same variant keys", () => {
		expect(surfaceClass.clip).toBe(surfaces.surfaceClip);
		expect(surfaceClass.zoom).toBe(surfaces.surfaceZoom);
		expect(surfaceClass.trim).toBe(surfaces.surfaceTrim);
		expect(surfaceClass.speed).toBe(surfaces.surfaceSpeed);
		expect(surfaceClass.mask).toBe(surfaces.surfaceMask);
		expect(surfaceClass.audio).toBe(surfaces.surfaceAudio);
		expect(surfaceClass.caption).toBe(surfaces.surfaceCaption);
		expect(surfaceClass.webcamLayout).toBe(surfaces.surfaceWebcamLayout);
		expect(surfaceClass.annotation).toBe(surfaces.surfaceAnnotation);
	});

	it("provides structural state classes", () => {
		expect(typeof surfaces.regionItem).toBe("string");
		expect(typeof surfaces.selected).toBe("string");
		expect(typeof surfaces.disabled).toBe("string");
		expect(typeof surfaces.muted).toBe("string");
		expect(typeof surfaces.ghost).toBe("string");
		expect(typeof surfaces.resizeHandle).toBe("string");
		expect(typeof surfaces.resizeHandleLeft).toBe("string");
		expect(typeof surfaces.resizeHandleRight).toBe("string");
	});

	it("provides row, toolbar, waveform and layer classes", () => {
		expect(typeof surfaces.timelineRow).toBe("string");
		expect(typeof surfaces.timelineRowEmpty).toBe("string");
		expect(typeof surfaces.timelineRowLabel).toBe("string");
		expect(typeof surfaces.timelineToolbar).toBe("string");
		expect(typeof surfaces.waveformCanvas).toBe("string");
		expect(typeof surfaces.timelineLayerAxis).toBe("string");
		expect(typeof surfaces.timelineLayerRows).toBe("string");
		expect(typeof surfaces.timelineLayerPlayhead).toBe("string");
		expect(typeof surfaces.timelineLayerMarkers).toBe("string");
		expect(typeof surfaces.timelineLayerTooltip).toBe("string");
		expect(typeof surfaces.timelineLayerOverlay).toBe("string");
	});

	it("falls back to annotation surface for unknown variants", () => {
		const cls = getRegionSurfaceClass("unknown" as TimelineVariant);
		expect(cls).toBe(surfaces.surfaceAnnotation);
	});
});
