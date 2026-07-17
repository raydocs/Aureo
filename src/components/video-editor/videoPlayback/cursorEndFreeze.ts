import type { CursorTelemetryPoint } from "../types";

export const DEFAULT_CURSOR_END_FREEZE_MAX_MS = 900;
export const DEFAULT_CURSOR_END_FREEZE_MIN_MS = 250;
export const DEFAULT_CURSOR_END_FREEZE_FRACTION = 0.25;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function interpolatePointAtTime(
	points: readonly CursorTelemetryPoint[],
	timeMs: number,
): CursorTelemetryPoint {
	let before = points[0];
	let after = points[points.length - 1];

	for (let index = 0; index < points.length; index += 1) {
		const point = points[index];
		if (point.timeMs <= timeMs) before = point;
		if (point.timeMs >= timeMs) {
			after = point;
			break;
		}
	}

	const spanMs = Math.max(0, after.timeMs - before.timeMs);
	const progress = spanMs > 0 ? clamp((timeMs - before.timeMs) / spanMs, 0, 1) : 0;
	return {
		...before,
		timeMs,
		cx: before.cx + (after.cx - before.cx) * progress,
		cy: before.cy + (after.cy - before.cy) * progress,
		interactionType: "move",
	};
}

export function stopCursorMovementAtEnd(
	points: readonly CursorTelemetryPoint[],
	endMs: number,
	startMs = 0,
): {
	points: CursorTelemetryPoint[];
	freezeStartMs: number | null;
	removedPointCount: number;
} {
	if (points.length < 2 || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
		return { points: [...points], freezeStartMs: null, removedPointCount: 0 };
	}

	const safeStartMs = Math.max(0, Math.round(startMs));
	const safeEndMs = Math.max(safeStartMs, Math.round(endMs));
	const visibleDurationMs = safeEndMs - safeStartMs;
	if (visibleDurationMs < DEFAULT_CURSOR_END_FREEZE_MIN_MS * 2) {
		return { points: [...points], freezeStartMs: null, removedPointCount: 0 };
	}

	const freezeDurationMs = clamp(
		visibleDurationMs * DEFAULT_CURSOR_END_FREEZE_FRACTION,
		DEFAULT_CURSOR_END_FREEZE_MIN_MS,
		DEFAULT_CURSOR_END_FREEZE_MAX_MS,
	);
	const freezeStartMs = Math.round(safeEndMs - freezeDurationMs);
	const hasSamplesAcrossFreeze =
		points.some((point) => point.timeMs <= freezeStartMs) &&
		points.some((point) => point.timeMs >= freezeStartMs);
	if (!hasSamplesAcrossFreeze) {
		return { points: [...points], freezeStartMs: null, removedPointCount: 0 };
	}

	const anchor = interpolatePointAtTime(points, freezeStartMs);
	const removedPointCount = points.filter(
		(point) => point.timeMs >= freezeStartMs && point.timeMs <= safeEndMs,
	).length;
	const before = points.filter((point) => point.timeMs < freezeStartMs);
	const after = points.filter((point) => point.timeMs > safeEndMs);
	const frozenEnd: CursorTelemetryPoint = {
		...anchor,
		timeMs: safeEndMs,
		interactionType: "move",
	};

	return {
		points: [...before, anchor, frozenEnd, ...after],
		freezeStartMs,
		removedPointCount,
	};
}
