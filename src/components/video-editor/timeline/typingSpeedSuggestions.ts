import type { CursorTelemetryPoint, PlaybackSpeed, SpeedRegion } from "../types";

export interface TypingSpeedSuggestion {
	startMs: number;
	endMs: number;
	keyCount: number;
	speed: PlaybackSpeed;
}

export type TypingSpeedSuggestionResult =
	| { status: "no-telemetry"; suggestions: [] }
	| { status: "no-typing"; suggestions: [] }
	| { status: "ready"; suggestions: TypingSpeedSuggestion[] };

export interface SuggestTypingSpeedRegionsOptions {
	totalMs: number;
	existingRegions?: Pick<SpeedRegion, "startMs" | "endMs">[];
	window?: { startMs: number; endMs: number } | null;
	speed?: PlaybackSpeed;
	maxKeyGapMs?: number;
	minKeyCount?: number;
	paddingBeforeMs?: number;
	paddingAfterMs?: number;
	minRegionDurationMs?: number;
}

function spansOverlap(
	left: { startMs: number; endMs: number },
	right: { startMs: number; endMs: number },
) {
	return left.startMs < right.endMs && left.endMs > right.startMs;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Finds sustained typing from privacy-safe keyboard timestamps. No key code or
 * typed text is required. Regions are suggestions: callers decide when to add
 * them to a project.
 */
export function suggestTypingSpeedRegions(
	telemetry: CursorTelemetryPoint[],
	options: SuggestTypingSpeedRegionsOptions,
): TypingSpeedSuggestionResult {
	const totalMs = Math.max(0, Math.round(options.totalMs));
	if (totalMs <= 0) return { status: "no-telemetry", suggestions: [] };

	const windowStartMs = clamp(Math.round(options.window?.startMs ?? 0), 0, totalMs);
	const windowEndMs = clamp(Math.round(options.window?.endMs ?? totalMs), windowStartMs, totalMs);
	const maxKeyGapMs = Math.max(100, options.maxKeyGapMs ?? 1_100);
	const minKeyCount = Math.max(2, Math.round(options.minKeyCount ?? 4));
	const paddingBeforeMs = Math.max(0, Math.round(options.paddingBeforeMs ?? 300));
	const paddingAfterMs = Math.max(0, Math.round(options.paddingAfterMs ?? 500));
	const minRegionDurationMs = Math.max(250, Math.round(options.minRegionDurationMs ?? 1_500));
	const speed = options.speed ?? 2;

	const keyTimes = telemetry
		.filter(
			(point) =>
				point.interactionType === "key" &&
				Number.isFinite(point.timeMs) &&
				point.timeMs >= windowStartMs &&
				point.timeMs <= windowEndMs,
		)
		.map((point) => Math.round(point.timeMs))
		.sort((left, right) => left - right);

	if (keyTimes.length === 0) return { status: "no-telemetry", suggestions: [] };

	const clusters: number[][] = [];
	for (const timeMs of keyTimes) {
		const current = clusters[clusters.length - 1];
		if (!current || timeMs - current[current.length - 1] > maxKeyGapMs) {
			clusters.push([timeMs]);
		} else {
			current.push(timeMs);
		}
	}

	const existingRegions = options.existingRegions ?? [];
	const suggestions = clusters
		.filter((cluster) => cluster.length >= minKeyCount)
		.map((cluster): TypingSpeedSuggestion => {
			let startMs = clamp(cluster[0] - paddingBeforeMs, windowStartMs, windowEndMs);
			let endMs = clamp(
				cluster[cluster.length - 1] + paddingAfterMs,
				windowStartMs,
				windowEndMs,
			);

			if (endMs - startMs < minRegionDurationMs) {
				const missingMs = minRegionDurationMs - (endMs - startMs);
				startMs = clamp(startMs - Math.ceil(missingMs / 2), windowStartMs, windowEndMs);
				endMs = clamp(startMs + minRegionDurationMs, windowStartMs, windowEndMs);
				startMs = clamp(endMs - minRegionDurationMs, windowStartMs, windowEndMs);
			}

			return { startMs, endMs, keyCount: cluster.length, speed };
		})
		.filter((suggestion) => suggestion.endMs > suggestion.startMs)
		.filter(
			(suggestion) => !existingRegions.some((existing) => spansOverlap(suggestion, existing)),
		);

	if (suggestions.length === 0) return { status: "no-typing", suggestions: [] };
	return { status: "ready", suggestions };
}
