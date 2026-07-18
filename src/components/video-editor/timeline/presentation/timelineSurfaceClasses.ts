import surfaces from "./surfaces.module.css";

export type TimelineVariant =
	| "zoom"
	| "trim"
	| "clip"
	| "annotation"
	| "mask"
	| "speed"
	| "audio"
	| "caption"
	| "webcam-layout";

const VARIANT_SURFACE_CLASS: Record<TimelineVariant, string> = {
	clip: surfaces.surfaceClip,
	zoom: surfaces.surfaceZoom,
	trim: surfaces.surfaceTrim,
	speed: surfaces.surfaceSpeed,
	mask: surfaces.surfaceMask,
	audio: surfaces.surfaceAudio,
	caption: surfaces.surfaceCaption,
	"webcam-layout": surfaces.surfaceWebcamLayout,
	annotation: surfaces.surfaceAnnotation,
};

export function getRegionSurfaceClass(variant: TimelineVariant): string {
	return VARIANT_SURFACE_CLASS[variant] ?? surfaces.surfaceAnnotation;
}

export { surfaces };
