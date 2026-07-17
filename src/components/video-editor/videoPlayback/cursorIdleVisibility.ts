import type { CursorTelemetryPoint } from "../types";

export const DEFAULT_CURSOR_IDLE_TIMEOUT_MS = 1_200;
export const CURSOR_IDLE_MOVEMENT_EPSILON = 0.0005;

const POINTER_INTERACTIONS = new Set<CursorTelemetryPoint["interactionType"]>([
	"click",
	"double-click",
	"right-click",
	"middle-click",
	"mouseup",
]);

/**
 * Builds the compact activity index used by preview and export. Cursor capture
 * samples continuously, so a new sample only counts when the pointer actually
 * moved or the user interacted with it.
 */
export function buildCursorActivityTimeline(
	samples: readonly CursorTelemetryPoint[],
	movementEpsilon = CURSOR_IDLE_MOVEMENT_EPSILON,
): number[] {
	const sortedSamples = samples
		.filter(
			(sample) =>
				Number.isFinite(sample.timeMs) &&
				Number.isFinite(sample.cx) &&
				Number.isFinite(sample.cy),
		)
		.slice()
		.sort((left, right) => left.timeMs - right.timeMs);
	if (sortedSamples.length === 0) return [];

	const activityTimes = [sortedSamples[0].timeMs];
	let activityAnchor = sortedSamples[0];
	for (let index = 1; index < sortedSamples.length; index += 1) {
		const sample = sortedSamples[index];
		const moved =
			Math.hypot(sample.cx - activityAnchor.cx, sample.cy - activityAnchor.cy) >
			movementEpsilon;
		const interacted = POINTER_INTERACTIONS.has(sample.interactionType);
		if (!moved && !interacted) continue;

		const previousActivityTime = activityTimes[activityTimes.length - 1];
		if (sample.timeMs !== previousActivityTime) {
			activityTimes.push(sample.timeMs);
		}
		activityAnchor = sample;
	}

	return activityTimes;
}

export function isCursorActiveAtTime(
	activityTimes: readonly number[],
	timeMs: number,
	timeoutMs = DEFAULT_CURSOR_IDLE_TIMEOUT_MS,
): boolean {
	if (activityTimes.length === 0 || !Number.isFinite(timeMs)) return false;
	if (timeMs < activityTimes[0]) return false;

	let low = 0;
	let high = activityTimes.length - 1;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if (activityTimes[middle] <= timeMs) low = middle;
		else high = middle - 1;
	}

	return timeMs - activityTimes[low] < Math.max(0, timeoutMs);
}

