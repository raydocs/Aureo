import { surfaces } from "./timelineSurfaceClasses";

export { surfaces };
export { getRegionSurfaceClass } from "./timelineSurfaceClasses";

export const surfaceClass = {
	clip: surfaces.surfaceClip,
	zoom: surfaces.surfaceZoom,
	trim: surfaces.surfaceTrim,
	speed: surfaces.surfaceSpeed,
	mask: surfaces.surfaceMask,
	audio: surfaces.surfaceAudio,
	caption: surfaces.surfaceCaption,
	webcamLayout: surfaces.surfaceWebcamLayout,
	annotation: surfaces.surfaceAnnotation,
};

export const itemClass = surfaces.regionItem;
export const selectedClass = surfaces.selected;
export const disabledClass = surfaces.disabled;
export const mutedClass = surfaces.muted;
export const ghostClass = surfaces.ghost;
export const handleClass = surfaces.resizeHandle;
export const handleLeftClass = surfaces.resizeHandleLeft;
export const handleRightClass = surfaces.resizeHandleRight;
export const rowClass = surfaces.timelineRow;
export const rowEmptyClass = surfaces.timelineRowEmpty;
export const rowLabelClass = surfaces.timelineRowLabel;
export const toolbarClass = surfaces.timelineToolbar;
export const waveformClass = surfaces.waveformCanvas;
export const layerAxis = surfaces.timelineLayerAxis;
export const layerRows = surfaces.timelineLayerRows;
export const layerPlayhead = surfaces.timelineLayerPlayhead;
export const layerMarkers = surfaces.timelineLayerMarkers;
export const layerTooltip = surfaces.timelineLayerTooltip;
export const layerOverlay = surfaces.timelineLayerOverlay;
