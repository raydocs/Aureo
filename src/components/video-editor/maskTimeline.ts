import type { Span } from "dnd-timeline";
import type { AnnotationRegion } from "./types";

export type MaskAnnotationType = "blur" | "highlight";

export function isMaskAnnotation(
	annotation: Pick<AnnotationRegion, "type">,
): annotation is Pick<AnnotationRegion, "type"> & { type: MaskAnnotationType } {
	return annotation.type === "blur" || annotation.type === "highlight";
}

export function maskSpansOverlap(
	left: Pick<AnnotationRegion, "startMs" | "endMs"> | Span,
	right: Pick<AnnotationRegion, "startMs" | "endMs"> | Span,
): boolean {
	const leftStart = "startMs" in left ? left.startMs : left.start;
	const leftEnd = "endMs" in left ? left.endMs : left.end;
	const rightStart = "startMs" in right ? right.startMs : right.start;
	const rightEnd = "endMs" in right ? right.endMs : right.end;
	return leftStart < rightEnd && leftEnd > rightStart;
}

/**
 * Resolve a non-overlapping Screen Studio-style mask span. Mask and highlight
 * regions share one lane and are intentionally mutually exclusive per frame.
 */
export function resolveMaskSpanAtMs(options: {
	annotations: AnnotationRegion[];
	startMs: number;
	totalMs: number;
	defaultDurationMs: number;
	minimumDurationMs?: number;
}): Span | null {
	const totalMs = Math.max(0, Math.round(options.totalMs));
	if (totalMs <= 0) return null;

	const start = Math.max(0, Math.min(Math.round(options.startMs), totalMs));
	const minimumDurationMs = Math.max(1, Math.round(options.minimumDurationMs ?? 1));
	const masks = options.annotations
		.filter(isMaskAnnotation)
		.sort((left, right) => left.startMs - right.startMs);

	if (masks.some((mask) => start >= mask.startMs && start < mask.endMs)) {
		return null;
	}

	const nextMaskStart = masks
		.filter((mask) => mask.startMs > start)
		.reduce((nearest, mask) => Math.min(nearest, mask.startMs), totalMs);
	const duration = Math.max(minimumDurationMs, Math.round(options.defaultDurationMs));
	const end = Math.min(totalMs, nextMaskStart, start + duration);
	return end - start >= minimumDurationMs ? { start, end } : null;
}

export function hasMaskOverlap(
	annotations: AnnotationRegion[],
	span: Span,
	excludeId?: string,
): boolean {
	return annotations.some(
		(annotation) =>
			annotation.id !== excludeId &&
			isMaskAnnotation(annotation) &&
			maskSpansOverlap(annotation, span),
	);
}
