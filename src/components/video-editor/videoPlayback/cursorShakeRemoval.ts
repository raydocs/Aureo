import type { CursorTelemetryPoint } from "../types";

export interface CursorShakeRemovalOptions {
	/** Maximum duration of a synthetic out-and-back excursion. */
	maxWindowMs?: number;
	/** Minimum normalized distance from the stable position to consider. */
	minExcursionDistance?: number;
	/** Largest normalized distance from the anchor that counts as returning. */
	maxReturnDistance?: number;
}

export interface CursorShakeRemovalResult {
	points: CursorTelemetryPoint[];
	shakeCount: number;
	replacedPointCount: number;
}

const DEFAULT_MAX_WINDOW_MS = 140;
const DEFAULT_MIN_EXCURSION_DISTANCE = 0.006;
const DEFAULT_MAX_RETURN_DISTANCE = 0.0035;
const MAX_RETURN_TO_EXCURSION_RATIO = 0.32;
const MIN_REVERSAL_COSINE = -0.45;

function isProtectedInteraction(point: CursorTelemetryPoint): boolean {
	return Boolean(point.interactionType && point.interactionType !== "move");
}

function distance(a: CursorTelemetryPoint, b: CursorTelemetryPoint): number {
	return Math.hypot(b.cx - a.cx, b.cy - a.cy);
}

function reversalCosine(
	anchor: CursorTelemetryPoint,
	excursion: CursorTelemetryPoint,
	returnPoint: CursorTelemetryPoint,
): number {
	const outgoingX = excursion.cx - anchor.cx;
	const outgoingY = excursion.cy - anchor.cy;
	const returningX = returnPoint.cx - excursion.cx;
	const returningY = returnPoint.cy - excursion.cy;
	const outgoingLength = Math.hypot(outgoingX, outgoingY);
	const returningLength = Math.hypot(returningX, returningY);
	if (outgoingLength === 0 || returningLength === 0) return 1;
	return (outgoingX * returningX + outgoingY * returningY) / (outgoingLength * returningLength);
}

/**
 * Removes short out-and-back pointer excursions while preserving timestamps,
 * cursor types and interaction metadata. This targets the synthetic shakes
 * produced by accessibility-based mouse tools rather than smoothing all motion.
 */
export function removeCursorShakes(
	samples: readonly CursorTelemetryPoint[],
	options: CursorShakeRemovalOptions = {},
): CursorShakeRemovalResult {
	if (samples.length < 3) {
		return { points: [...samples], shakeCount: 0, replacedPointCount: 0 };
	}

	const maxWindowMs = Math.max(1, options.maxWindowMs ?? DEFAULT_MAX_WINDOW_MS);
	const minExcursionDistance = Math.max(
		0,
		options.minExcursionDistance ?? DEFAULT_MIN_EXCURSION_DISTANCE,
	);
	const maxReturnDistance = Math.max(0, options.maxReturnDistance ?? DEFAULT_MAX_RETURN_DISTANCE);
	const points = samples.map((sample) => ({ ...sample }));
	let shakeCount = 0;
	let replacedPointCount = 0;

	for (let startIndex = 1; startIndex < points.length - 1; startIndex += 1) {
		const anchor = points[startIndex - 1];
		const excursion = points[startIndex];
		if (isProtectedInteraction(excursion)) continue;

		const excursionDistance = distance(anchor, excursion);
		if (excursionDistance < minExcursionDistance) continue;

		let returnIndex = -1;
		let furthestIndex = startIndex;
		let furthestDistance = excursionDistance;
		for (
			let candidateIndex = startIndex + 1;
			candidateIndex < points.length;
			candidateIndex += 1
		) {
			const candidate = points[candidateIndex];
			if (candidate.timeMs - anchor.timeMs > maxWindowMs) break;
			if (isProtectedInteraction(candidate)) break;

			const candidateDistance = distance(anchor, candidate);
			if (candidateDistance > furthestDistance) {
				furthestDistance = candidateDistance;
				furthestIndex = candidateIndex;
			}
			const returnThreshold = Math.min(
				maxReturnDistance,
				furthestDistance * MAX_RETURN_TO_EXCURSION_RATIO,
			);
			if (candidateDistance <= returnThreshold) {
				returnIndex = candidateIndex;
				break;
			}
		}

		if (returnIndex < 0) continue;
		const returnPoint = points[returnIndex];
		const furthestPoint = points[furthestIndex];
		if (reversalCosine(anchor, furthestPoint, returnPoint) > MIN_REVERSAL_COSINE) {
			continue;
		}

		const spanMs = returnPoint.timeMs - anchor.timeMs;
		if (spanMs <= 0) continue;
		for (let index = startIndex; index < returnIndex; index += 1) {
			const point = points[index];
			const progress = Math.min(1, Math.max(0, (point.timeMs - anchor.timeMs) / spanMs));
			point.cx = anchor.cx + (returnPoint.cx - anchor.cx) * progress;
			point.cy = anchor.cy + (returnPoint.cy - anchor.cy) * progress;
			replacedPointCount += 1;
		}
		shakeCount += 1;
		startIndex = returnIndex - 1;
	}

	return { points, shakeCount, replacedPointCount };
}
