import type { CursorTelemetryPoint } from "../types";

type CursorType = NonNullable<CursorTelemetryPoint["cursorType"]>;

export interface CursorTypeOptimizationResult {
	points: CursorTelemetryPoint[];
	optimizedRunCount: number;
	replacedPointCount: number;
}

interface CursorTypeRun {
	type: CursorType;
	startIndex: number;
	endIndex: number;
}

const DEFAULT_TRANSIENT_TYPE_WINDOW_MS = 160;

function effectiveCursorTypes(samples: readonly CursorTelemetryPoint[]): CursorType[] {
	let latestType: CursorType = "arrow";
	return samples.map((sample) => {
		if (sample.cursorType) latestType = sample.cursorType;
		return latestType;
	});
}

function buildRuns(types: readonly CursorType[]): CursorTypeRun[] {
	if (types.length === 0) return [];
	const runs: CursorTypeRun[] = [];
	let startIndex = 0;
	for (let index = 1; index <= types.length; index += 1) {
		if (index < types.length && types[index] === types[startIndex]) continue;
		runs.push({ type: types[startIndex], startIndex, endIndex: index - 1 });
		startIndex = index;
	}
	return runs;
}

function hasProtectedInteraction(
	samples: readonly CursorTelemetryPoint[],
	startIndex: number,
	endIndex: number,
): boolean {
	for (let index = startIndex; index <= endIndex; index += 1) {
		const interaction = samples[index].interactionType;
		if (interaction && interaction !== "move" && interaction !== "mouseup") return true;
	}
	return false;
}

/**
 * Collapses brief A → B → A cursor-type bounces while leaving deliberate type
 * changes intact. Coordinates, timing and interaction metadata are untouched.
 */
export function optimizeOriginalCursorTypes(
	samples: readonly CursorTelemetryPoint[],
	transientWindowMs = DEFAULT_TRANSIENT_TYPE_WINDOW_MS,
): CursorTypeOptimizationResult {
	if (samples.length < 3) {
		return {
			points: samples.map((sample) => ({ ...sample })),
			optimizedRunCount: 0,
			replacedPointCount: 0,
		};
	}

	const points = samples.map((sample) => ({ ...sample }));
	const types = effectiveCursorTypes(points);
	const runs = buildRuns(types);
	let optimizedRunCount = 0;
	let replacedPointCount = 0;
	const maxWindowMs = Math.max(0, transientWindowMs);

	for (let runIndex = 1; runIndex < runs.length - 1; runIndex += 1) {
		const previous = runs[runIndex - 1];
		const transient = runs[runIndex];
		const next = runs[runIndex + 1];
		if (previous.type !== next.type || transient.type === previous.type) continue;
		if (hasProtectedInteraction(points, transient.startIndex, transient.endIndex)) continue;

		const dwellMs = points[next.startIndex].timeMs - points[transient.startIndex].timeMs;
		if (dwellMs < 0 || dwellMs > maxWindowMs) continue;

		for (let index = transient.startIndex; index <= transient.endIndex; index += 1) {
			points[index].cursorType = previous.type;
			replacedPointCount += 1;
		}
		optimizedRunCount += 1;
	}

	return { points, optimizedRunCount, replacedPointCount };
}

/** Forces the visual cursor to use the default variant without changing motion. */
export function forceDefaultCursorType(
	samples: readonly CursorTelemetryPoint[],
): CursorTelemetryPoint[] {
	return samples.map((sample) => ({ ...sample, cursorType: "arrow" }));
}
