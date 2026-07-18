import type { CursorTelemetryPoint, ZoomFocus } from "../types";

export const MIN_DWELL_DURATION_MS = 450;
export const MAX_DWELL_DURATION_MS = 2600;
export const DWELL_MOVE_THRESHOLD = 0.02;
export const MIN_FRESH_RECORDING_AUTO_ZOOM_SOURCE_ASPECT_RATIO = 1.2;

export interface ZoomDwellCandidate {
	centerTimeMs: number;
	focus: ZoomFocus;
	strength: number;
}

export interface CursorInteractionCandidate extends ZoomDwellCandidate {
	kind:
		| "dwell"
		| "click-like"
		| "double-click-like"
		| "text-focus-like"
		| "dropdown-open"
		| "text-selection"
		| "text-field-click";
	source: "explicit" | "heuristic";
}

export interface SuggestedZoomRegion {
	start: number;
	end: number;
	focus: ZoomFocus;
}

export type InteractionZoomSuggestionStatus =
	| "ok"
	| "no-telemetry"
	| "no-interactions"
	| "no-slots";

export interface InteractionZoomSuggestionResult {
	status: InteractionZoomSuggestionStatus;
	suggestions: SuggestedZoomRegion[];
}

export function shouldAutoApplyFreshRecordingZoomsForSource(
	sourceWidth?: number,
	sourceHeight?: number,
): boolean {
	if (
		!Number.isFinite(sourceWidth) ||
		!Number.isFinite(sourceHeight) ||
		(sourceWidth ?? 0) <= 0 ||
		(sourceHeight ?? 0) <= 0
	) {
		return true;
	}

	return (
		(sourceWidth as number) / (sourceHeight as number) >=
		MIN_FRESH_RECORDING_AUTO_ZOOM_SOURCE_ASPECT_RATIO
	);
}

/** Max gap between consecutive clicks before they are split into separate zoom clusters. */
export const CLICK_CLUSTER_MERGE_GAP_MS = 2500;
/** Padding added before the first click and after the last click in a cluster. */
export const CLICK_CLUSTER_PAD_MS = 500;
const EXPLICIT_CLICK_TYPES = new Set<NonNullable<CursorTelemetryPoint["interactionType"]>>([
	"click",
	"double-click",
	"right-click",
	"middle-click",
]);

function isExplicitClickType(
	interactionType: CursorTelemetryPoint["interactionType"],
): interactionType is NonNullable<CursorTelemetryPoint["interactionType"]> {
	return typeof interactionType === "string" && EXPLICIT_CLICK_TYPES.has(interactionType);
}

function normalizeTelemetrySample(
	sample: CursorTelemetryPoint,
	totalMs: number,
): CursorTelemetryPoint {
	return {
		timeMs: Math.max(0, Math.min(sample.timeMs, totalMs)),
		cx: Math.max(0, Math.min(sample.cx, 1)),
		cy: Math.max(0, Math.min(sample.cy, 1)),
		interactionType: sample.interactionType,
		cursorType: sample.cursorType,
	};
}

function applyCursorTypeInRange(
	samples: CursorTelemetryPoint[],
	startMs: number,
	endMs: number,
	cursorType: NonNullable<CursorTelemetryPoint["cursorType"]>,
) {
	for (const sample of samples) {
		if (sample.timeMs < startMs || sample.timeMs > endMs) continue;
		if (!sample.cursorType) {
			sample.cursorType = cursorType;
		}
	}
}

export function normalizeCursorTelemetry(
	telemetry: CursorTelemetryPoint[],
	totalMs: number,
): CursorTelemetryPoint[] {
	const normalized = [...telemetry]
		.filter(
			(sample) =>
				Number.isFinite(sample.timeMs) &&
				Number.isFinite(sample.cx) &&
				Number.isFinite(sample.cy),
		)
		.sort((a, b) => a.timeMs - b.timeMs)
		.map((sample) => normalizeTelemetrySample(sample, totalMs));

	const interactions = detectInteractionCandidates(normalized);
	for (const candidate of interactions) {
		if (candidate.kind === "text-selection") {
			applyCursorTypeInRange(
				normalized,
				candidate.centerTimeMs - 140,
				candidate.centerTimeMs + 1200,
				"text",
			);
			continue;
		}

		if (candidate.kind === "text-field-click" || candidate.kind === "text-focus-like") {
			applyCursorTypeInRange(
				normalized,
				candidate.centerTimeMs - 100,
				candidate.centerTimeMs + 900,
				"text",
			);
			continue;
		}
	}

	for (const sample of normalized) {
		if (sample.interactionType !== "click" && sample.interactionType !== "double-click") {
			continue;
		}

		const mouseUp = normalized.find(
			(candidate) =>
				candidate.timeMs > sample.timeMs && candidate.interactionType === "mouseup",
		);
		if (!mouseUp) {
			continue;
		}

		const dragDuration = mouseUp.timeMs - sample.timeMs;
		const dragDistance = Math.hypot(mouseUp.cx - sample.cx, mouseUp.cy - sample.cy);
		if (dragDuration >= 160 && dragDistance > 0.015) {
			const isTextDrag =
				Math.abs(mouseUp.cx - sample.cx) > Math.abs(mouseUp.cy - sample.cy) * 1.8;
			applyCursorTypeInRange(
				normalized,
				sample.timeMs,
				mouseUp.timeMs,
				isTextDrag ? "text" : "closed-hand",
			);
		}
	}

	return normalized;
}

export function detectZoomDwellCandidates(samples: CursorTelemetryPoint[]): ZoomDwellCandidate[] {
	if (samples.length < 2) {
		return [];
	}

	const dwellCandidates: ZoomDwellCandidate[] = [];
	let runStart = 0;

	const pushRunIfDwell = (startIndex: number, endIndexExclusive: number) => {
		if (endIndexExclusive - startIndex < 2) {
			return;
		}

		const start = samples[startIndex];
		const end = samples[endIndexExclusive - 1];
		const runDuration = end.timeMs - start.timeMs;
		if (runDuration < MIN_DWELL_DURATION_MS || runDuration > MAX_DWELL_DURATION_MS) {
			return;
		}

		const runSamples = samples.slice(startIndex, endIndexExclusive);
		const avgCx = runSamples.reduce((sum, sample) => sum + sample.cx, 0) / runSamples.length;
		const avgCy = runSamples.reduce((sum, sample) => sum + sample.cy, 0) / runSamples.length;

		dwellCandidates.push({
			centerTimeMs: Math.round((start.timeMs + end.timeMs) / 2),
			focus: { cx: avgCx, cy: avgCy },
			strength: runDuration,
		});
	};

	for (let index = 1; index < samples.length; index += 1) {
		const prev = samples[index - 1];
		const curr = samples[index];
		const distance = Math.hypot(curr.cx - prev.cx, curr.cy - prev.cy);

		if (distance > DWELL_MOVE_THRESHOLD) {
			pushRunIfDwell(runStart, index);
			runStart = index;
		}
	}
	pushRunIfDwell(runStart, samples.length);

	return dwellCandidates;
}

export function detectInteractionCandidates(
	samples: CursorTelemetryPoint[],
): CursorInteractionCandidate[] {
	// --- Phase 1: Explicit interaction events (from uiohook telemetry) ---
	const clickEvents = samples.filter((sample) => isExplicitClickType(sample.interactionType));

	const explicitInteractionCandidates: CursorInteractionCandidate[] = [];

	for (const clickSample of clickEvents) {
		// Classify what happened AFTER this click by analyzing cursor trajectory
		const kind = classifyPostClickBehavior(samples, clickSample);

		const baseStrength =
			kind === "double-click-like"
				? 1500
				: kind === "dropdown-open"
					? 1200
					: kind === "text-selection"
						? 1300
						: kind === "text-field-click"
							? 1100
							: 900;

		explicitInteractionCandidates.push({
			centerTimeMs: Math.round(clickSample.timeMs),
			focus: { cx: clickSample.cx, cy: clickSample.cy },
			strength: baseStrength,
			kind,
			source: "explicit",
		});
	}

	// --- Phase 2: Dwell-based heuristic candidates ---
	const dwellCandidates = detectZoomDwellCandidates(samples).map<CursorInteractionCandidate>(
		(candidate) => {
			if (candidate.strength >= 1100) {
				return { ...candidate, kind: "text-focus-like", source: "heuristic" };
			}
			if (candidate.strength <= 800) {
				return { ...candidate, kind: "click-like", source: "heuristic" };
			}
			return { ...candidate, kind: "dwell", source: "heuristic" };
		},
	);

	// --- Phase 3: Synthetic double-click detection from dwell pairs ---
	const doubleClickCandidates: CursorInteractionCandidate[] = [];
	const sortedByTime = [...dwellCandidates].sort((a, b) => a.centerTimeMs - b.centerTimeMs);

	for (let index = 1; index < sortedByTime.length; index += 1) {
		const prev = sortedByTime[index - 1];
		const curr = sortedByTime[index];
		const timeGap = curr.centerTimeMs - prev.centerTimeMs;
		const spatialGap = Math.hypot(curr.focus.cx - prev.focus.cx, curr.focus.cy - prev.focus.cy);
		const bothShort = prev.strength <= 900 && curr.strength <= 900;

		if (bothShort && timeGap <= 450 && spatialGap <= 0.035) {
			doubleClickCandidates.push({
				centerTimeMs: Math.round((prev.centerTimeMs + curr.centerTimeMs) / 2),
				focus: {
					cx: (prev.focus.cx + curr.focus.cx) / 2,
					cy: (prev.focus.cy + curr.focus.cy) / 2,
				},
				strength: prev.strength + curr.strength + 500,
				kind: "double-click-like",
				source: "heuristic",
			});
		}
	}

	return [...explicitInteractionCandidates, ...dwellCandidates, ...doubleClickCandidates];
}

/**
 * Groups a sorted list of click timestamps into clusters where consecutive
 * clicks are no more than `mergeGapMs` apart. Returns an array of
 * `{ firstMs, lastMs, focus }` objects, one per cluster.  The focus is taken
 * from the click with the highest interaction strength, falling back to the
 * centroid of all clicks in the cluster.
 */
function buildClickClusters(
	clicks: CursorInteractionCandidate[],
	mergeGapMs: number,
): Array<{ firstMs: number; lastMs: number; focus: ZoomFocus }> {
	if (clicks.length === 0) {
		return [];
	}

	const sorted = [...clicks].sort((a, b) => a.centerTimeMs - b.centerTimeMs);
	const clusters: Array<{ firstMs: number; lastMs: number; focus: ZoomFocus }> = [];

	let clusterStart = sorted[0].centerTimeMs;
	let clusterEnd = sorted[0].centerTimeMs;
	let bestStrength = sorted[0].strength;
	let bestFocus = sorted[0].focus;
	let sumCx = sorted[0].focus.cx;
	let sumCy = sorted[0].focus.cy;
	let count = 1;

	for (let i = 1; i < sorted.length; i++) {
		const click = sorted[i];
		const gap = click.centerTimeMs - clusterEnd;

		if (gap <= mergeGapMs) {
			// Extend current cluster
			clusterEnd = Math.max(clusterEnd, click.centerTimeMs);
			if (click.strength > bestStrength) {
				bestStrength = click.strength;
				bestFocus = click.focus;
			}
			sumCx += click.focus.cx;
			sumCy += click.focus.cy;
			count += 1;
		} else {
			// Flush current cluster and start a new one
			clusters.push({
				firstMs: clusterStart,
				lastMs: clusterEnd,
				focus: bestFocus ?? { cx: sumCx / count, cy: sumCy / count },
			});
			clusterStart = click.centerTimeMs;
			clusterEnd = click.centerTimeMs;
			bestStrength = click.strength;
			bestFocus = click.focus;
			sumCx = click.focus.cx;
			sumCy = click.focus.cy;
			count = 1;
		}
	}

	// Flush last cluster
	clusters.push({
		firstMs: clusterStart,
		lastMs: clusterEnd,
		focus: bestFocus ?? { cx: sumCx / count, cy: sumCy / count },
	});

	return clusters;
}

export interface ZoomSuggestionClipRegion {
	startMs: number;
	endMs: number;
}

function resolveSuggestionClips(
	clips: ZoomSuggestionClipRegion[] | undefined,
	totalMs: number,
): ZoomSuggestionClipRegion[] {
	if (!clips || clips.length === 0) {
		return [{ startMs: 0, endMs: totalMs }];
	}

	return [...clips]
		.filter(
			(clip) =>
				Number.isFinite(clip.startMs) &&
				Number.isFinite(clip.endMs) &&
				clip.endMs > clip.startMs,
		)
		.sort((a, b) => a.startMs - b.startMs);
}

function findClipContainingCluster(
	cluster: { firstMs: number; lastMs: number },
	clips: ZoomSuggestionClipRegion[],
): ZoomSuggestionClipRegion | null {
	for (const clip of clips) {
		if (cluster.firstMs >= clip.startMs && cluster.lastMs <= clip.endMs) {
			return clip;
		}
	}
	return null;
}

/**
 * Builds a duration-aware window for a click cluster, then shifts it to fit
 * inside the given clip/media bounds. Returns null when the required duration
 * cannot fit safely inside the clip.
 */
function placeClusterWindow(params: {
	cluster: { firstMs: number; lastMs: number };
	padMs: number;
	defaultDurationMs: number;
	clip: ZoomSuggestionClipRegion;
	totalMs: number;
}): { start: number; end: number } | null {
	const { cluster, padMs, defaultDurationMs, clip, totalMs } = params;

	const interactionStart = cluster.firstMs - padMs;
	const interactionEnd = cluster.lastMs + padMs;
	const interactionDuration = Math.max(0, interactionEnd - interactionStart);
	const desiredDuration = Math.max(interactionDuration, defaultDurationMs, 0);
	if (desiredDuration <= 0) {
		return null;
	}

	const centerMs = (cluster.firstMs + cluster.lastMs) / 2;
	let start = centerMs - desiredDuration / 2;
	let end = start + desiredDuration;

	const boundStart = Math.max(0, clip.startMs);
	const boundEnd = Math.min(totalMs, clip.endMs);
	const available = boundEnd - boundStart;
	if (available < desiredDuration) {
		return null;
	}

	if (start < boundStart) {
		end += boundStart - start;
		start = boundStart;
	}
	if (end > boundEnd) {
		start -= end - boundEnd;
		end = boundEnd;
	}

	start = Math.max(boundStart, start);
	end = Math.min(boundEnd, end);

	if (end - start < desiredDuration - 0.5) {
		return null;
	}

	return {
		start: Math.round(start),
		end: Math.round(end),
	};
}

function spansOverlapWithSpacing(
	start: number,
	end: number,
	span: { start: number; end: number },
	spacingMs: number,
): boolean {
	return end + spacingMs > span.start && start - spacingMs < span.end;
}

export function buildInteractionZoomSuggestions(params: {
	cursorTelemetry: CursorTelemetryPoint[];
	totalMs: number;
	defaultDurationMs: number;
	reservedSpans?: Array<{ start: number; end: number }>;
	spacingMs?: number;
	mergeGapMs?: number;
	padMs?: number;
	/** Retained clip regions in timeline coordinates. Empty/omitted = full media. */
	clips?: ZoomSuggestionClipRegion[];
}): InteractionZoomSuggestionResult {
	const {
		cursorTelemetry,
		totalMs,
		defaultDurationMs,
		reservedSpans = [],
		spacingMs = 0,
		mergeGapMs = CLICK_CLUSTER_MERGE_GAP_MS,
		padMs = CLICK_CLUSTER_PAD_MS,
		clips,
	} = params;

	if (totalMs <= 0) {
		return { status: "no-slots", suggestions: [] };
	}

	const safeDefaultDurationMs =
		Number.isFinite(defaultDurationMs) && defaultDurationMs > 0 ? defaultDurationMs : 0;
	const safeSpacingMs = Number.isFinite(spacingMs) && spacingMs > 0 ? spacingMs : 0;
	const activeClips = resolveSuggestionClips(clips, totalMs);

	const normalizedSamples = normalizeCursorTelemetry(cursorTelemetry, totalMs);
	if (normalizedSamples.length === 0) {
		return { status: "no-telemetry", suggestions: [] };
	}

	if (
		normalizedSamples.length === 1 &&
		!isExplicitClickType(normalizedSamples[0].interactionType)
	) {
		return { status: "no-telemetry", suggestions: [] };
	}

	// Only use explicit click events (uiohook telemetry) – ignore dwell heuristics
	const clickCandidates = detectInteractionCandidates(normalizedSamples).filter(
		(candidate) => candidate.source === "explicit",
	);

	if (clickCandidates.length === 0) {
		return { status: "no-interactions", suggestions: [] };
	}

	// Group nearby clicks into clusters, then derive zoom windows from those clusters
	const clusters = buildClickClusters(clickCandidates, mergeGapMs);

	const reserved = [...reservedSpans]
		.filter(
			(span) =>
				Number.isFinite(span.start) && Number.isFinite(span.end) && span.end > span.start,
		)
		.sort((a, b) => a.start - b.start);
	const suggestions: SuggestedZoomRegion[] = [];

	for (const cluster of clusters) {
		const clip = findClipContainingCluster(cluster, activeClips);
		if (!clip) {
			// Cluster sits in a removed gap or bridges multiple retained clips.
			continue;
		}

		const placed = placeClusterWindow({
			cluster,
			padMs,
			defaultDurationMs: safeDefaultDurationMs,
			clip,
			totalMs,
		});
		if (!placed || placed.end <= placed.start) {
			continue;
		}

		const hasOverlap = reserved.some((span) =>
			spansOverlapWithSpacing(placed.start, placed.end, span, safeSpacingMs),
		);
		if (hasOverlap) {
			continue;
		}

		reserved.push({ start: placed.start, end: placed.end });
		reserved.sort((a, b) => a.start - b.start);
		suggestions.push({
			start: placed.start,
			end: placed.end,
			focus: cluster.focus,
		});
	}

	if (suggestions.length === 0) {
		return { status: "no-slots", suggestions: [] };
	}

	// Sort chronologically
	suggestions.sort((a, b) => a.start - b.start);

	return { status: "ok", suggestions };
}

/**
 * Analyzes cursor movement after a click to classify the interaction pattern.
 *
 * - **dropdown-open**: click followed by slow downward cursor movement (browsing items)
 * - **text-selection**: click followed by primarily horizontal drag movement
 * - **text-field-click**: click followed by cursor staying mostly still (dwell)
 * - **double-click-like**: explicit double-click interaction type
 * - **click-like**: generic click with no recognizable post-click pattern
 */
function classifyPostClickBehavior(
	samples: CursorTelemetryPoint[],
	clickSample: CursorTelemetryPoint,
): CursorInteractionCandidate["kind"] {
	// Explicit double-click from uiohook
	if (clickSample.interactionType === "double-click") {
		return "double-click-like";
	}

	const clickTime = clickSample.timeMs;

	// Check for mouseup shortly after (drag detection)
	const mouseUpAfter = samples.find(
		(s) =>
			s.interactionType === "mouseup" && s.timeMs > clickTime && s.timeMs - clickTime < 3000,
	);

	if (mouseUpAfter) {
		const dragDx = Math.abs(mouseUpAfter.cx - clickSample.cx);
		const dragDy = Math.abs(mouseUpAfter.cy - clickSample.cy);
		const dragDuration = mouseUpAfter.timeMs - clickTime;

		// Text selection: horizontal drag > 3% of screen, mostly horizontal, duration 200ms+
		if (dragDuration >= 200 && dragDx > 0.03 && dragDx > dragDy * 1.8) {
			return "text-selection";
		}
	}

	// Analyze trajectory in the 400ms-2000ms window after click
	const moveSamples = samples.filter(
		(s) =>
			s.timeMs > clickTime + 100 &&
			s.timeMs <= clickTime + 2000 &&
			(s.interactionType === "move" || !s.interactionType),
	);

	if (moveSamples.length < 3) {
		// Very few move samples after click = cursor stayed still = text field click
		return "text-field-click";
	}

	// Compute displacement from click position
	let maxDist = 0;
	let totalAbsDy = 0;
	let totalAbsDx = 0;
	for (const s of moveSamples) {
		const dist = Math.hypot(s.cx - clickSample.cx, s.cy - clickSample.cy);
		maxDist = Math.max(maxDist, dist);
		totalAbsDx += Math.abs(s.cx - clickSample.cx);
		totalAbsDy += Math.abs(s.cy - clickSample.cy);
	}

	// Cursor barely moved after click: text field click (dwell)
	if (maxDist < 0.02) {
		return "text-field-click";
	}

	// Primarily downward movement after click: dropdown open
	const lastMoveSample = moveSamples[moveSamples.length - 1];
	const netDy = lastMoveSample.cy - clickSample.cy;

	if (netDy > 0.03 && totalAbsDy > totalAbsDx * 1.5) {
		return "dropdown-open";
	}

	// Primarily horizontal movement: text selection (fallback if no mouseup)
	if (totalAbsDx > 0.03 && totalAbsDx > totalAbsDy * 1.8) {
		return "text-selection";
	}

	return "click-like";
}
