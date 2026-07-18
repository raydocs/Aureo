import type { Span } from "dnd-timeline";
import type { ForwardedRef, RefObject } from "react";
import { useCallback, useImperativeHandle } from "react";
import {
	type MaskAnnotationType,
	resolveMaskSpanAtMs as resolveAvailableMaskSpanAtMs,
} from "../../maskTimeline";
import type {
	AnnotationRegion,
	AudioRegion,
	CaptionCue,
	ClipRegion,
	CursorTelemetryPoint,
	SpeedRegion,
	TrimRegion,
	WebcamLayoutRegion,
	ZoomFocus,
	ZoomRegion,
} from "../../types";
import type { TimelineShortcutBindings } from "../core/timelineTypes";
import type { TimelineEditorHandle } from "../TimelineEditor";
import { useTimelineAudioActions } from "./actions/useTimelineAudioActions";
import { useTimelineCaptionActions } from "./actions/useTimelineCaptionActions";
import { useTimelineZoomActions } from "./actions/useTimelineZoomActions";
import { useTimelineDndBindings } from "./useTimelineDndBindings";
import { useTimelineKeyboardShortcuts } from "./useTimelineKeyboardShortcuts";
import { useTimelineNormalization } from "./useTimelineNormalization";
import { useTimelineSelection } from "./useTimelineSelection";

interface UseTimelineEditorRuntimeParams {
	ref: ForwardedRef<TimelineEditorHandle>;
	videoDuration: number;
	totalMs: number;
	currentTimeMs: number;
	handleZoomToPlayhead: () => void;
	safeMinDurationMs: number;
	cursorTelemetry: CursorTelemetryPoint[];
	autoSuggestZoomsTrigger: number;
	onAutoSuggestZoomsConsumed?: () => void;
	disableSuggestedZooms: boolean;
	zoomRegions: ZoomRegion[];
	onZoomAdded: (span: Span) => void;
	onZoomSuggested?: (span: Span, focus: ZoomFocus) => void;
	onZoomSpanChange: (id: string, span: Span) => void;
	onZoomDelete: (id: string) => void;
	selectedZoomId: string | null;
	onSelectZoom: (id: string | null) => void;
	trimRegions: TrimRegion[];
	onTrimSpanChange?: (id: string, span: Span) => void;
	clipRegions: ClipRegion[];
	onClipSplit?: (splitMs: number) => void;
	onClipSpanChange?: (id: string, span: Span) => void;
	onClipDelete?: (id: string) => void;
	selectedClipId?: string | null;
	onSelectClip?: (id: string | null) => void;
	annotationRegions: AnnotationRegion[];
	onAnnotationAdded?: (span: Span, trackIndex?: number) => void;
	onMaskAdded?: (span: Span, type: MaskAnnotationType) => void;
	onAnnotationSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAnnotationDelete?: (id: string) => void;
	selectedAnnotationId?: string | null;
	onSelectAnnotation?: (id: string | null) => void;
	speedRegions: SpeedRegion[];
	onSpeedSpanChange?: (id: string, span: Span) => void;
	onSpeedDelete?: (id: string) => void;
	selectedSpeedId?: string | null;
	onSelectSpeed?: (id: string | null) => void;
	audioRegions: AudioRegion[];
	onAudioAdded?: (span: Span, audioPath: string, trackIndex?: number) => void;
	onAudioSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAudioDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	onSelectAudio?: (id: string | null) => void;
	captionCues: CaptionCue[];
	onCaptionSpanChange?: (id: string, span: Span) => void;
	onCaptionDelete?: (id: string) => void;
	onCaptionAdded?: (span: Span) => void;
	selectedCaptionId?: string | null;
	onSelectCaption?: (id: string | null) => void;
	webcamLayouts: WebcamLayoutRegion[];
	onWebcamLayoutAdded?: (span: Span) => void;
	onWebcamLayoutSpanChange?: (id: string, span: Span) => void;
	onWebcamLayoutDelete?: (id: string) => void;
	selectedWebcamLayoutId?: string | null;
	onSelectWebcamLayout?: (id: string | null) => void;
	isMac: boolean;
	keyShortcuts: TimelineShortcutBindings;
	isTimelineFocusedRef: RefObject<boolean>;
}

export function useTimelineEditorRuntime({
	ref,
	videoDuration,
	totalMs,
	currentTimeMs,
	handleZoomToPlayhead,
	safeMinDurationMs,
	cursorTelemetry,
	autoSuggestZoomsTrigger,
	onAutoSuggestZoomsConsumed,
	disableSuggestedZooms,
	zoomRegions,
	onZoomAdded,
	onZoomSuggested,
	onZoomSpanChange,
	onZoomDelete,
	selectedZoomId,
	onSelectZoom,
	trimRegions,
	onTrimSpanChange,
	clipRegions,
	onClipSplit,
	onClipSpanChange,
	onClipDelete,
	selectedClipId,
	onSelectClip,
	annotationRegions,
	onAnnotationAdded,
	onMaskAdded,
	onAnnotationSpanChange,
	onAnnotationDelete,
	selectedAnnotationId,
	onSelectAnnotation,
	speedRegions,
	onSpeedSpanChange,
	onSpeedDelete,
	selectedSpeedId,
	onSelectSpeed,
	audioRegions,
	onAudioAdded,
	onAudioSpanChange,
	onAudioDelete,
	selectedAudioId,
	onSelectAudio,
	captionCues,
	onCaptionSpanChange,
	onCaptionDelete,
	onCaptionAdded,
	selectedCaptionId,
	onSelectCaption,
	webcamLayouts,
	onWebcamLayoutAdded,
	onWebcamLayoutSpanChange,
	onWebcamLayoutDelete,
	selectedWebcamLayoutId,
	onSelectWebcamLayout,
	isMac,
	keyShortcuts,
	isTimelineFocusedRef,
}: UseTimelineEditorRuntimeParams) {
	const {
		keyframes,
		selectedKeyframeId,
		setSelectedKeyframeId,
		selectAllBlocksActive,
		setSelectAllBlocksActive,
		hasAnyZoomBlocks,
		activateSelectAllZooms,
		addKeyframe,
		deleteSelectedKeyframe,
		handleKeyframeMove,
		deleteSelectedZoom,
		deleteSelectedClip,
		deleteSelectedSpeed,
		deleteSelectedAnnotation,
		deleteSelectedAudio,
		deleteSelectedCaption,
		deleteSelectedWebcamLayout,
		clearSelectedBlocks,
		handleSelectZoom,
		handleSelectClip,
		handleSelectSpeed,
		handleSelectAnnotation,
		handleSelectAudio,
		handleSelectCaption,
		handleSelectWebcamLayout,
		cycleAnnotationsAtCurrentTime,
	} = useTimelineSelection({
		totalMs,
		currentTimeMs,
		zoomRegions,
		clipRegions,
		speedRegions,
		annotationRegions,
		audioRegions,
		selectedZoomId,
		selectedClipId,
		selectedSpeedId,
		selectedAnnotationId,
		selectedAudioId,
		selectedCaptionId,
		selectedWebcamLayoutId,
		onZoomDelete,
		onClipDelete,
		onSpeedDelete,
		onAnnotationDelete,
		onAudioDelete,
		onCaptionDelete,
		onWebcamLayoutDelete,
		onSelectZoom,
		onSelectClip,
		onSelectSpeed,
		onSelectAnnotation,
		onSelectAudio,
		onSelectCaption,
		onSelectWebcamLayout,
	});

	useTimelineNormalization({
		totalMs,
		safeMinDurationMs,
		zoomRegions,
		trimRegions,
		speedRegions,
		audioRegions,
		onZoomSpanChange,
		onTrimSpanChange,
		onSpeedSpanChange,
		onAudioSpanChange,
		onWebcamLayoutSpanChange,
	});

	const {
		hasOverlap,
		timelineItems,
		allRegionSpans,
		getResolvedDropRowId,
		handleItemSpanChange,
	} = useTimelineDndBindings({
		zoomRegions,
		trimRegions,
		clipRegions,
		annotationRegions,
		speedRegions,
		audioRegions,
		captionCues,
		webcamLayouts,
		onZoomSpanChange,
		onTrimSpanChange,
		onClipSpanChange,
		onAnnotationSpanChange,
		onSpeedSpanChange,
		onAudioSpanChange,
		onCaptionSpanChange,
		onWebcamLayoutSpanChange,
	});

	const {
		defaultRegionDurationMs,
		canPlaceZoomAtMs,
		addZoomAtMs,
		handleAddZoom,
		handleSuggestZooms,
	} = useTimelineZoomActions({
		timeline: { videoDuration, totalMs, currentTimeMs },
		regions: { zoom: zoomRegions, clip: clipRegions },
		cursorTelemetry,
		options: { disableSuggestedZooms },
		autoSuggestZoomsTrigger,
		onAutoSuggestZoomsConsumed,
		onZoomAdded,
		onZoomSuggested,
	});

	const { canPlaceCaptionAtMs, addCaptionAtMs, resolveCaptionSpanAtMs } =
		useTimelineCaptionActions({
			totalMs,
			captionRegions: captionCues,
			onCaptionAdded,
		});

	const resolveWebcamLayoutSpanAtMs = useCallback(
		(startMs: number) => {
			if (!onWebcamLayoutAdded || totalMs <= 0) return null;
			const start = Math.max(0, Math.min(Math.round(startMs), totalMs));
			if (webcamLayouts.some((layout) => start >= layout.startMs && start < layout.endMs)) {
				return null;
			}
			const nextStart = webcamLayouts
				.filter((layout) => layout.startMs > start)
				.reduce((nearest, layout) => Math.min(nearest, layout.startMs), totalMs);
			const end = Math.min(nextStart, totalMs, start + 3000);
			return end - start >= safeMinDurationMs ? { start, end } : null;
		},
		[onWebcamLayoutAdded, safeMinDurationMs, totalMs, webcamLayouts],
	);
	const canPlaceWebcamLayoutAtMs = useCallback(
		(startMs: number) => resolveWebcamLayoutSpanAtMs(startMs) !== null,
		[resolveWebcamLayoutSpanAtMs],
	);
	const addWebcamLayoutAtMs = useCallback(
		(startMs: number) => {
			const span = resolveWebcamLayoutSpanAtMs(startMs);
			if (span) onWebcamLayoutAdded?.(span);
		},
		[onWebcamLayoutAdded, resolveWebcamLayoutSpanAtMs],
	);

	const handleSplitClip = useCallback(() => {
		if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onClipSplit) {
			return;
		}
		onClipSplit(currentTimeMs);
	}, [videoDuration, totalMs, currentTimeMs, onClipSplit]);

	const { handleAddAudio } = useTimelineAudioActions({
		timeline: { videoDuration, totalMs, currentTimeMs },
		regions: { audio: audioRegions },
		onAudioAdded,
	});

	const handleAddAnnotation = useCallback(
		(trackIndex = 0) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAnnotationAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			const latestStartPos = Math.max(0, totalMs - defaultDuration);
			const startPos = Math.max(0, Math.min(currentTimeMs, latestStartPos));
			const endPos = Math.min(startPos + defaultDuration, totalMs);
			onAnnotationAdded({ start: startPos, end: endPos }, trackIndex);
		},
		[videoDuration, totalMs, currentTimeMs, defaultRegionDurationMs, onAnnotationAdded],
	);

	const resolveMaskSpanAtMs = useCallback(
		(startMs: number) =>
			resolveAvailableMaskSpanAtMs({
				annotations: annotationRegions,
				startMs,
				totalMs,
				defaultDurationMs: defaultRegionDurationMs,
				minimumDurationMs: safeMinDurationMs,
			}),
		[annotationRegions, defaultRegionDurationMs, safeMinDurationMs, totalMs],
	);
	const canPlaceMaskAtMs = useCallback(
		(startMs: number) => Boolean(onMaskAdded && resolveMaskSpanAtMs(startMs)),
		[onMaskAdded, resolveMaskSpanAtMs],
	);
	const addMaskAtMs = useCallback(
		(startMs: number, type: MaskAnnotationType = "blur") => {
			const span = resolveMaskSpanAtMs(startMs);
			if (span) onMaskAdded?.(span, type);
		},
		[onMaskAdded, resolveMaskSpanAtMs],
	);
	const handleAddMask = useCallback(
		(type: MaskAnnotationType = "blur") => addMaskAtMs(currentTimeMs, type),
		[addMaskAtMs, currentTimeMs],
	);

	useTimelineKeyboardShortcuts({
		isMac,
		keyShortcuts,
		isTimelineFocusedRef,
		hasAnyZoomBlocks,
		activateSelectAllZooms,
		annotationCount: annotationRegions.length,
		selectedKeyframeId,
		selectedZoomId,
		selectedClipId,
		selectedSpeedId,
		selectedAnnotationId,
		selectedAudioId,
		selectedCaptionId,
		selectedWebcamLayoutId,
		selectAllBlocksActive,
		addKeyframe,
		handleAddZoom,
		handleSplitClip,
		handleAddAnnotation: () => handleAddAnnotation(),
		deleteSelectedKeyframe,
		deleteSelectedZoom,
		deleteSelectedClip,
		deleteSelectedSpeed,
		deleteSelectedAnnotation,
		deleteSelectedAudio,
		deleteSelectedCaption,
		deleteSelectedWebcamLayout,
		cycleAnnotationsAtCurrentTime,
	});

	useImperativeHandle(
		ref,
		() => ({
			addZoom: handleAddZoom,
			suggestZooms: handleSuggestZooms,
			zoomToPlayhead: handleZoomToPlayhead,
			splitClip: handleSplitClip,
			addAnnotation: handleAddAnnotation,
			addMask: handleAddMask,
			addAudio: handleAddAudio,
			keyframes,
		}),
		[
			handleAddAnnotation,
			handleAddAudio,
			handleAddMask,
			handleAddZoom,
			handleSuggestZooms,
			handleSplitClip,
			handleZoomToPlayhead,
			keyframes,
		],
	);

	return {
		keyframes,
		selectedKeyframeId,
		setSelectedKeyframeId,
		selectAllBlocksActive,
		setSelectAllBlocksActive,
		handleKeyframeMove,
		clearSelectedBlocks,
		handleSelectZoom,
		handleSelectClip,
		handleSelectSpeed,
		handleSelectAnnotation,
		handleSelectAudio,
		handleSelectCaption,
		handleSelectWebcamLayout,
		hasOverlap,
		timelineItems,
		allRegionSpans,
		getResolvedDropRowId,
		handleItemSpanChange,
		canPlaceZoomAtMs,
		addZoomAtMs,
		canPlaceCaptionAtMs,
		addCaptionAtMs,
		resolveCaptionSpanAtMs,
		canPlaceWebcamLayoutAtMs,
		addWebcamLayoutAtMs,
		resolveWebcamLayoutSpanAtMs,
		canPlaceMaskAtMs,
		addMaskAtMs,
		resolveMaskSpanAtMs,
		handleAddZoom,
		handleSuggestZooms,
		handleSplitClip,
		handleAddAudio,
		handleAddAnnotation,
		handleAddMask,
	};
}
