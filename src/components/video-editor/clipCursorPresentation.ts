import type { ClipRegion } from "./types";
import { getClipSourceEndMs } from "./types";

export interface ClipCursorPresentation {
	visible: boolean;
	smoothingEnabled: boolean;
	clipId: string | null;
}

export const DEFAULT_CLIP_CURSOR_PRESENTATION: ClipCursorPresentation = {
	visible: true,
	smoothingEnabled: true,
	clipId: null,
};

/** Resolve per-clip cursor overrides using source-media time. */
export function getClipCursorPresentationAtSourceTime(
	clips: ClipRegion[] | null | undefined,
	timeMs: number,
): ClipCursorPresentation {
	if (!clips?.length || !Number.isFinite(timeMs)) {
		return DEFAULT_CLIP_CURSOR_PRESENTATION;
	}

	const roundedTimeMs = Math.max(0, Math.round(timeMs));
	const clip = [...clips]
		.sort((left, right) => left.startMs - right.startMs)
		.find(
			(candidate) =>
				roundedTimeMs >= candidate.startMs && roundedTimeMs < getClipSourceEndMs(candidate),
		);

	if (!clip) return DEFAULT_CLIP_CURSOR_PRESENTATION;
	return {
		visible: !clip.hideCursor,
		smoothingEnabled: !clip.disableCursorSmoothing,
		clipId: clip.id,
	};
}
