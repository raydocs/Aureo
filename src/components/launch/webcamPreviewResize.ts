import { WEBCAM_PREVIEW_SIZE_RANGE } from "./webcamPreviewAppearance";
import { WEBCAM_PREVIEW_ANCHOR } from "./webcamPreviewPlacement";

export const WEBCAM_RESIZE_HANDLE_SIZE = 24;
export const WEBCAM_RESIZE_SNAP_TOLERANCE = 6;
export const WEBCAM_RESIZE_QUANTIZE_STEP = 8;

export type WebcamResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

function clampStartSize(size: number): number {
	return Number.isFinite(size)
		? clamp(size, WEBCAM_PREVIEW_SIZE_RANGE.min, WEBCAM_PREVIEW_SIZE_RANGE.max)
		: WEBCAM_PREVIEW_SIZE_RANGE.min;
}

function findNearestSnap(size: number, snapSizes: readonly number[]): number | null {
	let nearest: number | null = null;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (const snapSize of snapSizes) {
		if (!Number.isFinite(snapSize)) continue;
		const distance = Math.abs(size - snapSize);
		if (distance <= WEBCAM_RESIZE_SNAP_TOLERANCE && distance < nearestDistance) {
			nearest = snapSize;
			nearestDistance = distance;
		}
	}

	return nearest;
}

/** Compute the inward handle inset for a rounded square preview corner. */
export function computeResizeCornerInset(size: number, roundness: number): number {
	if (!Number.isFinite(size) || !Number.isFinite(roundness) || size < 0 || roundness < 0) {
		return 0;
	}

	return size * (clamp(roundness, 0, 100) / 200) * (1 - Math.SQRT1_2);
}

/** Compute a resized preview square while preserving its fixed corner or center. */
export function computeResizedPreviewBox(params: {
	corner: WebcamResizeCorner;
	startSize: number;
	startOffset: { x: number; y: number };
	delta: { x: number; y: number };
	centerScale: boolean;
	quantize: boolean;
	snapSizes: readonly number[];
	viewport: { width: number; height: number };
}): { size: number; offset: { x: number; y: number }; snappedTo: number | null } {
	const { startSize, startOffset, delta, viewport } = params;
	const degenerate =
		!Number.isFinite(startSize) ||
		!Number.isFinite(startOffset.x) ||
		!Number.isFinite(startOffset.y) ||
		!Number.isFinite(delta.x) ||
		!Number.isFinite(delta.y) ||
		!Number.isFinite(viewport.width) ||
		!Number.isFinite(viewport.height) ||
		viewport.width <= 0 ||
		viewport.height <= 0;

	if (degenerate) {
		return {
			size: clampStartSize(startSize),
			offset: startOffset,
			snappedTo: null,
		};
	}

	const signs: Record<WebcamResizeCorner, { x: number; y: number }> = {
		"top-left": { x: -1, y: -1 },
		"top-right": { x: 1, y: -1 },
		"bottom-left": { x: -1, y: 1 },
		"bottom-right": { x: 1, y: 1 },
	};
	const sign = signs[params.corner];
	let size1 =
		startSize + ((sign.x * delta.x + sign.y * delta.y) / 2) * (params.centerScale ? 2 : 1);

	if (params.quantize) {
		size1 = Math.round(size1 / WEBCAM_RESIZE_QUANTIZE_STEP) * WEBCAM_RESIZE_QUANTIZE_STEP;
	}

	let snappedTo = findNearestSnap(size1, params.snapSizes);
	if (snappedTo !== null) size1 = snappedTo;
	size1 = clamp(size1, WEBCAM_PREVIEW_SIZE_RANGE.min, WEBCAM_PREVIEW_SIZE_RANGE.max);

	const bottomRight = {
		x: viewport.width - WEBCAM_PREVIEW_ANCHOR.right + startOffset.x,
		y: viewport.height - WEBCAM_PREVIEW_ANCHOR.bottom + startOffset.y,
	};
	const topLeft = { x: bottomRight.x - startSize, y: bottomRight.y - startSize };
	const topRight = { x: bottomRight.x, y: bottomRight.y - startSize };
	const bottomLeft = { x: bottomRight.x - startSize, y: bottomRight.y };

	let maxSize: number;
	if (params.centerScale) {
		const center = {
			x: bottomRight.x - startSize / 2,
			y: bottomRight.y - startSize / 2,
		};
		maxSize =
			2 * Math.min(center.x, viewport.width - center.x, center.y, viewport.height - center.y);
	} else if (params.corner === "top-left") {
		maxSize = Math.min(bottomRight.x, bottomRight.y);
	} else if (params.corner === "bottom-right") {
		maxSize = Math.min(viewport.width - topLeft.x, viewport.height - topLeft.y);
	} else if (params.corner === "top-right") {
		maxSize = Math.min(viewport.width - bottomLeft.x, bottomLeft.y);
	} else {
		maxSize = Math.min(topRight.x, viewport.height - topRight.y);
	}

	let size = clamp(
		Math.min(size1, maxSize),
		WEBCAM_PREVIEW_SIZE_RANGE.min,
		WEBCAM_PREVIEW_SIZE_RANGE.max,
	);
	if (snappedTo !== null && size !== snappedTo) snappedTo = null;
	size = Math.round(size);

	const d = size - startSize;
	let offsetX = startOffset.x;
	let offsetY = startOffset.y;
	if (params.centerScale) {
		offsetX += d / 2;
		offsetY += d / 2;
	} else if (params.corner === "bottom-right") {
		offsetX += d;
		offsetY += d;
	} else if (params.corner === "top-right") {
		offsetX += d;
	} else if (params.corner === "bottom-left") {
		offsetY += d;
	}

	return {
		size,
		offset: { x: round2(offsetX), y: round2(offsetY) },
		snappedTo,
	};
}

/** Adapt one keyboard arrow step to the same constrained geometry used by pointer resizing. */
export function computeKeyboardResizedPreviewBox(params: {
	corner: WebcamResizeCorner;
	key: string;
	startSize: number;
	startOffset: { x: number; y: number };
	coarse: boolean;
	centerScale: boolean;
	snapSizes: readonly number[];
	viewport: { width: number; height: number };
}): ReturnType<typeof computeResizedPreviewBox> | null {
	const arrowKeys: readonly ArrowKey[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
	if (!arrowKeys.includes(params.key as ArrowKey)) return null;

	const key = params.key as ArrowKey;
	const grows =
		(key === "ArrowLeft" && params.corner.endsWith("left")) ||
		(key === "ArrowRight" && params.corner.endsWith("right")) ||
		(key === "ArrowUp" && params.corner.startsWith("top")) ||
		(key === "ArrowDown" && params.corner.startsWith("bottom"));
	const shrinks =
		(key === "ArrowLeft" && params.corner.endsWith("right")) ||
		(key === "ArrowRight" && params.corner.endsWith("left")) ||
		(key === "ArrowUp" && params.corner.startsWith("bottom")) ||
		(key === "ArrowDown" && params.corner.startsWith("top"));
	if (!grows && !shrinks) return null;

	const cornerSign = {
		x: params.corner.endsWith("left") ? -1 : 1,
		y: params.corner.startsWith("top") ? -1 : 1,
	};
	const sizeStep = params.coarse ? 16 : 8;
	const pointerStep = (grows ? sizeStep : -sizeStep) / (params.centerScale ? 2 : 1);

	return computeResizedPreviewBox({
		corner: params.corner,
		startSize: params.startSize,
		startOffset: params.startOffset,
		delta: {
			x: cornerSign.x * pointerStep,
			y: cornerSign.y * pointerStep,
		},
		centerScale: params.centerScale,
		quantize: false,
		snapSizes: params.snapSizes,
		viewport: params.viewport,
	});
}
