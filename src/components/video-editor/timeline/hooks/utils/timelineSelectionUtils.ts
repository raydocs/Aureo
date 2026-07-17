export type DeleteSelectionTarget =
	| "keyframe"
	| "zoom"
	| "clip"
	| "speed"
	| "annotation"
	| "audio"
	| "caption"
	| "webcam-layout"
	| "none";

interface ResolveDeleteSelectionTargetParams {
	selectAllBlocksActive: boolean;
	selectedKeyframeId: string | null;
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedSpeedId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	selectedCaptionId?: string | null;
	selectedWebcamLayoutId?: string | null;
}

export function resolveDeleteSelectionTarget({
	selectAllBlocksActive,
	selectedKeyframeId,
	selectedZoomId,
	selectedClipId,
	selectedSpeedId,
	selectedAnnotationId,
	selectedAudioId,
	selectedCaptionId,
	selectedWebcamLayoutId,
}: ResolveDeleteSelectionTargetParams): DeleteSelectionTarget {
	if (selectAllBlocksActive) return "zoom";
	if (selectedKeyframeId) return "keyframe";
	if (selectedZoomId) return "zoom";
	if (selectedClipId) return "clip";
	if (selectedSpeedId) return "speed";
	if (selectedAnnotationId) return "annotation";
	if (selectedAudioId) return "audio";
	if (selectedCaptionId) return "caption";
	if (selectedWebcamLayoutId) return "webcam-layout";
	return "none";
}
