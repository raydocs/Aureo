import { useCallback, useMemo, useState } from "react";
import type { TimelineRegion } from "../core/timelineTypes";

interface UseTimelineSelectionParams {
	totalMs: number;
	currentTimeMs: number;
	zoomRegions: TimelineRegion[];
	clipRegions: TimelineRegion[];
	speedRegions: TimelineRegion[];
	annotationRegions: (TimelineRegion & { zIndex: number })[];
	audioRegions: TimelineRegion[];
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedSpeedId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	selectedCaptionId?: string | null;
	selectedWebcamLayoutId?: string | null;
	onZoomDelete: (id: string) => void;
	onClipDelete?: (id: string) => void;
	onSpeedDelete?: (id: string) => void;
	onAnnotationDelete?: (id: string) => void;
	onAudioDelete?: (id: string) => void;
	onCaptionDelete?: (id: string) => void;
	onWebcamLayoutDelete?: (id: string) => void;
	onSelectZoom: (id: string | null) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectSpeed?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	onSelectCaption?: (id: string | null) => void;
	onSelectWebcamLayout?: (id: string | null) => void;
}

export function useTimelineSelection({
	totalMs,
	currentTimeMs,
	zoomRegions,
	annotationRegions,
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
}: UseTimelineSelectionParams) {
	const [keyframes, setKeyframes] = useState<{ id: string; time: number }[]>([]);
	const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
	const [selectAllBlocksActive, setSelectAllBlocksActive] = useState(false);
	const hasAnyZoomBlocks = useMemo(() => zoomRegions.length > 0, [zoomRegions.length]);

	const addKeyframe = useCallback(() => {
		if (totalMs === 0) return;
		const time = Math.max(0, Math.min(currentTimeMs, totalMs));
		if (keyframes.some((kf) => Math.abs(kf.time - time) < 1)) return;
		setKeyframes((prev) => [...prev, { id: globalThis.crypto.randomUUID(), time }]);
	}, [currentTimeMs, totalMs, keyframes]);

	const deleteSelectedKeyframe = useCallback(() => {
		if (!selectedKeyframeId) return;
		setKeyframes((prev) => prev.filter((kf) => kf.id !== selectedKeyframeId));
		setSelectedKeyframeId(null);
	}, [selectedKeyframeId]);

	const handleKeyframeMove = useCallback(
		(id: string, newTime: number) => {
			setKeyframes((prev) =>
				prev.map((kf) =>
					kf.id === id ? { ...kf, time: Math.max(0, Math.min(newTime, totalMs)) } : kf,
				),
			);
		},
		[totalMs],
	);

	const deleteSelectedZoom = useCallback(() => {
		if (selectAllBlocksActive) {
			zoomRegions.map((region) => region.id).forEach((id) => onZoomDelete(id));
		} else if (selectedZoomId) {
			onZoomDelete(selectedZoomId);
		} else {
			return;
		}

		onSelectZoom(null);
		onSelectClip?.(null);
		onSelectAnnotation?.(null);
		onSelectAudio?.(null);
		onSelectCaption?.(null);
		setSelectAllBlocksActive(false);
	}, [
		selectAllBlocksActive,
		zoomRegions,
		onZoomDelete,
		selectedZoomId,
		onSelectZoom,
		onSelectClip,
		onSelectAnnotation,
		onSelectAudio,
		onSelectCaption,
	]);

	const deleteSelectedClip = useCallback(() => {
		if (!selectedClipId || !onClipDelete || !onSelectClip) return;
		onClipDelete(selectedClipId);
		onSelectClip(null);
	}, [selectedClipId, onClipDelete, onSelectClip]);

	const deleteSelectedSpeed = useCallback(() => {
		if (!selectedSpeedId || !onSpeedDelete || !onSelectSpeed) return;
		onSpeedDelete(selectedSpeedId);
		onSelectSpeed(null);
	}, [selectedSpeedId, onSpeedDelete, onSelectSpeed]);

	const deleteSelectedAnnotation = useCallback(() => {
		if (!selectedAnnotationId || !onAnnotationDelete || !onSelectAnnotation) return;
		onAnnotationDelete(selectedAnnotationId);
		onSelectAnnotation(null);
	}, [selectedAnnotationId, onAnnotationDelete, onSelectAnnotation]);

	const deleteSelectedAudio = useCallback(() => {
		if (!selectedAudioId || !onAudioDelete || !onSelectAudio) return;
		onAudioDelete(selectedAudioId);
		onSelectAudio(null);
	}, [selectedAudioId, onAudioDelete, onSelectAudio]);

	const deleteSelectedCaption = useCallback(() => {
		if (!selectedCaptionId || !onCaptionDelete) return;
		onCaptionDelete(selectedCaptionId);
		onSelectCaption?.(null);
	}, [selectedCaptionId, onCaptionDelete, onSelectCaption]);

	const deleteSelectedWebcamLayout = useCallback(() => {
		if (!selectedWebcamLayoutId || !onWebcamLayoutDelete) return;
		onWebcamLayoutDelete(selectedWebcamLayoutId);
		onSelectWebcamLayout?.(null);
	}, [selectedWebcamLayoutId, onWebcamLayoutDelete, onSelectWebcamLayout]);

	const clearSelectedBlocks = useCallback(() => {
		onSelectZoom(null);
		onSelectClip?.(null);
		onSelectSpeed?.(null);
		onSelectAnnotation?.(null);
		onSelectAudio?.(null);
		onSelectCaption?.(null);
		onSelectWebcamLayout?.(null);
		setSelectAllBlocksActive(false);
	}, [
		onSelectZoom,
		onSelectClip,
		onSelectSpeed,
		onSelectAnnotation,
		onSelectAudio,
		onSelectCaption,
		onSelectWebcamLayout,
	]);

	const activateSelectAllZooms = useCallback(() => {
		onSelectZoom(null);
		onSelectClip?.(null);
		onSelectSpeed?.(null);
		onSelectAnnotation?.(null);
		onSelectAudio?.(null);
		onSelectCaption?.(null);
		onSelectWebcamLayout?.(null);
		setSelectedKeyframeId(null);
		setSelectAllBlocksActive(true);
	}, [
		onSelectZoom,
		onSelectClip,
		onSelectSpeed,
		onSelectAnnotation,
		onSelectAudio,
		onSelectCaption,
		onSelectWebcamLayout,
	]);

	const handleSelectZoom = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectZoom(id);
		},
		[onSelectZoom],
	);

	const handleSelectClip = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectClip?.(id);
		},
		[onSelectClip],
	);

	const handleSelectSpeed = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectSpeed?.(id);
		},
		[onSelectSpeed],
	);

	const handleSelectAnnotation = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectAnnotation?.(id);
		},
		[onSelectAnnotation],
	);

	const handleSelectAudio = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectAudio?.(id);
		},
		[onSelectAudio],
	);

	const handleSelectCaption = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectCaption?.(id);
		},
		[onSelectCaption],
	);

	const handleSelectWebcamLayout = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectWebcamLayout?.(id);
		},
		[onSelectWebcamLayout],
	);

	const cycleAnnotationsAtCurrentTime = useCallback(
		(backward = false) => {
			const overlapping = annotationRegions
				.filter((a) => currentTimeMs >= a.startMs && currentTimeMs <= a.endMs)
				.sort((a, b) => a.zIndex - b.zIndex);
			if (overlapping.length === 0) {
				return false;
			}

			if (!selectedAnnotationId || !overlapping.some((a) => a.id === selectedAnnotationId)) {
				onSelectAnnotation?.(overlapping[0].id);
				return true;
			}

			const currentIndex = overlapping.findIndex((a) => a.id === selectedAnnotationId);
			const nextIndex = backward
				? (currentIndex - 1 + overlapping.length) % overlapping.length
				: (currentIndex + 1) % overlapping.length;
			onSelectAnnotation?.(overlapping[nextIndex].id);
			return true;
		},
		[annotationRegions, currentTimeMs, selectedAnnotationId, onSelectAnnotation],
	);

	return {
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
	};
}
