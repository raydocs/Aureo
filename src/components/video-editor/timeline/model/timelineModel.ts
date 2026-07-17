import { formatClipSpeedLabel } from "../../clipSpeedChange";
import { isMaskAnnotation } from "../../maskTimeline";
import type {
	AnnotationRegion,
	AudioRegion,
	CaptionCue,
	ClipRegion,
	SpeedRegion,
	WebcamLayoutRegion,
	ZoomRegion,
} from "../../types";
import {
	CAPTION_ROW_ID,
	CLIP_ROW_ID,
	MASK_ROW_ID,
	SPEED_ROW_ID,
	WEBCAM_LAYOUT_ROW_ID,
	ZOOM_ROW_ID,
} from "../core/constants";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../core/rows";
import type { TimelineRegionSpan, TimelineRenderItem } from "../core/timelineTypes";

export function getAnnotationLabel(region: AnnotationRegion): string {
	if (region.type === "text") {
		const preview = region.content.trim() || "Empty text";
		return preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
	}
	if (region.type === "image") {
		return "Image";
	}
	if (region.type === "blur") {
		return "Sensitive Data";
	}
	if (region.type === "highlight") {
		return `Highlight ${Math.round((region.highlightOpacity ?? 0.54) * 100)}%`;
	}
	return "Annotation";
}

export function getAudioLabel(region: AudioRegion): string {
	return (
		region.audioPath
			.split(/[\\/]/)
			.pop()
			?.replace(/\.[^.]+$/, "") || "Audio"
	);
}

function getCaptionLabel(cue: CaptionCue): string {
	const preview = cue.text.trim() || "Caption";
	return preview.length > 24 ? `${preview.substring(0, 24)}...` : preview;
}

export function buildTimelineItems(params: {
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	speedRegions?: SpeedRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	captionCues?: CaptionCue[];
	webcamLayouts?: WebcamLayoutRegion[];
}): TimelineRenderItem[] {
	const {
		zoomRegions,
		clipRegions,
		speedRegions = [],
		annotationRegions,
		audioRegions,
		captionCues = [],
		webcamLayouts = [],
	} = params;
	const zooms: TimelineRenderItem[] = zoomRegions.map((region, index) => ({
		id: region.id,
		rowId: ZOOM_ROW_ID,
		span: { start: region.startMs, end: region.endMs },
		label: `Zoom ${index + 1}`,
		zoomDepth: region.depth,
		zoomMode: region.mode ?? "auto",
		variant: "zoom",
	}));

	const clips: TimelineRenderItem[] = clipRegions.map((region, index) => {
		const displayDurationMs = Math.max(0, region.endMs - region.startMs);
		const speed = Number.isFinite(region.speed) && region.speed > 0 ? region.speed : 1;
		const sourceEndMs = region.startMs + displayDurationMs * speed;
		const speedLabel = formatClipSpeedLabel(speed);

		return {
			id: region.id,
			rowId: CLIP_ROW_ID,
			span: { start: region.startMs, end: region.endMs },
			sourceSpan: { start: region.startMs, end: sourceEndMs },
			label: speedLabel ? `Clip ${index + 1} ${speedLabel}` : `Clip ${index + 1}`,
			speedValue: speedLabel ? speed : undefined,
			showSourceAudio: region.showSourceAudio,
			muted: Boolean(region.muted),
			hideCursor: Boolean(region.hideCursor),
			disableCursorSmoothing: Boolean(region.disableCursorSmoothing),
			variant: "clip",
		};
	});
	const speeds: TimelineRenderItem[] = speedRegions.map((region) => ({
		id: region.id,
		rowId: SPEED_ROW_ID,
		span: { start: region.startMs, end: region.endMs },
		label: `${region.speed}×`,
		speedValue: region.speed,
		variant: "speed",
	}));

	const annotations: TimelineRenderItem[] = annotationRegions.map((region) => ({
		id: region.id,
		rowId: isMaskAnnotation(region)
			? MASK_ROW_ID
			: getAnnotationTrackRowId(region.trackIndex ?? 0),
		span: { start: region.startMs, end: region.endMs },
		label: getAnnotationLabel(region),
		maskType: isMaskAnnotation(region) ? region.type : undefined,
		maskOpacity: region.highlightOpacity,
		maskDisabled: Boolean(region.disabled),
		variant: isMaskAnnotation(region) ? "mask" : "annotation",
	}));

	const audios: TimelineRenderItem[] = audioRegions.map((region) => ({
		id: region.id,
		rowId: getAudioTrackRowId(region.trackIndex ?? 0),
		span: { start: region.startMs, end: region.endMs },
		label: getAudioLabel(region),
		audioPath: region.audioPath,
		audioGain: region.volume,
		audioNormalize: Boolean(region.normalize),
		variant: "audio",
	}));

	const captions: TimelineRenderItem[] = captionCues.map((cue) => ({
		id: cue.id,
		rowId: CAPTION_ROW_ID,
		span: { start: cue.startMs, end: cue.endMs },
		label: getCaptionLabel(cue),
		variant: "caption",
	}));
	const cameraLayouts: TimelineRenderItem[] = webcamLayouts.map((layout) => ({
		id: layout.id,
		rowId: WEBCAM_LAYOUT_ROW_ID,
		span: { start: layout.startMs, end: layout.endMs },
		label:
			layout.mode === "fullscreen"
				? "Fullscreen"
				: layout.mode === "hidden"
					? "Hidden"
					: "Default",
		webcamLayoutMode: layout.mode,
		variant: "webcam-layout",
	}));

	return [
		...zooms,
		...clips,
		...speeds,
		...cameraLayouts,
		...annotations,
		...audios,
		...captions,
	];
}

export function buildAllRegionSpans(params: {
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	speedRegions?: SpeedRegion[];
	annotationRegions?: AnnotationRegion[];
	audioRegions: AudioRegion[];
	webcamLayouts?: WebcamLayoutRegion[];
}): TimelineRegionSpan[] {
	const {
		zoomRegions,
		clipRegions,
		speedRegions = [],
		annotationRegions = [],
		audioRegions,
		webcamLayouts = [],
	} = params;
	const zooms = zoomRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: ZOOM_ROW_ID,
	}));
	const clips = clipRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: CLIP_ROW_ID,
	}));
	const speeds = speedRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: SPEED_ROW_ID,
	}));
	const masks = annotationRegions.filter(isMaskAnnotation).map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: MASK_ROW_ID,
	}));
	const audios = audioRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: getAudioTrackRowId(r.trackIndex ?? 0),
	}));
	const cameraLayouts = webcamLayouts.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: WEBCAM_LAYOUT_ROW_ID,
	}));
	return [...zooms, ...clips, ...speeds, ...cameraLayouts, ...masks, ...audios];
}

export function resolveDropRowId(
	id: string,
	proposedRowId: string,
	timelineItems: TimelineRenderItem[],
) {
	const currentRowId = timelineItems.find((item) => item.id === id)?.rowId;
	if (!currentRowId) {
		return proposedRowId;
	}

	if (isAnnotationTrackRowId(currentRowId)) {
		return isAnnotationTrackRowId(proposedRowId)
			? getAnnotationTrackRowId(getAnnotationTrackIndex(proposedRowId))
			: currentRowId;
	}

	if (isAudioTrackRowId(currentRowId)) {
		return isAudioTrackRowId(proposedRowId)
			? getAudioTrackRowId(getAudioTrackIndex(proposedRowId))
			: currentRowId;
	}

	return currentRowId;
}
