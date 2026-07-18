import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import {
	buildInteractionZoomSuggestions,
	CLICK_CLUSTER_MERGE_GAP_MS,
	CLICK_CLUSTER_PAD_MS,
	shouldAutoApplyFreshRecordingZoomsForSource,
} from "./zoomSuggestionUtils";

function makeClick(
	timeMs: number,
	cx = 0.5,
	cy = 0.5,
	interactionType: CursorTelemetryPoint["interactionType"] = "click",
): CursorTelemetryPoint {
	return { timeMs, cx, cy, interactionType };
}

function makeMove(timeMs: number, cx = 0.5, cy = 0.5): CursorTelemetryPoint {
	return { timeMs, cx, cy, interactionType: "move" };
}

/** Wraps click samples with surrounding move events to mimic real mixed telemetry. */
function withMoves(clicks: CursorTelemetryPoint[], totalMs: number): CursorTelemetryPoint[] {
	return [makeMove(0), ...clicks, makeMove(totalMs)];
}

const TOTAL_MS = 30_000;
const DEFAULT_DURATION_MS = 3_000;

describe("shouldAutoApplyFreshRecordingZoomsForSource", () => {
	it("allows automatic fresh-recording zooms for landscape captures", () => {
		expect(shouldAutoApplyFreshRecordingZoomsForSource(1920, 1080)).toBe(true);
		expect(shouldAutoApplyFreshRecordingZoomsForSource(1280, 960)).toBe(true);
	});

	it("blocks automatic fresh-recording zooms for narrow or near-square captures", () => {
		expect(shouldAutoApplyFreshRecordingZoomsForSource(960, 1020)).toBe(false);
		expect(shouldAutoApplyFreshRecordingZoomsForSource(1080, 1080)).toBe(false);
	});

	it("does not block when source dimensions are not available yet", () => {
		expect(shouldAutoApplyFreshRecordingZoomsForSource()).toBe(true);
	});
});

describe("buildInteractionZoomSuggestions (click-cluster logic)", () => {
	it("creates one zoom track for a single isolated click with at least defaultDurationMs", () => {
		const telemetry = withMoves([makeClick(5_000)], TOTAL_MS);

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(1);

		const [s] = result.suggestions;
		expect(s.end - s.start).toBe(DEFAULT_DURATION_MS);
		expect(s.start).toBe(5_000 - DEFAULT_DURATION_MS / 2);
		expect(s.end).toBe(5_000 + DEFAULT_DURATION_MS / 2);
	});

	it("accepts a single explicit click sample without needing surrounding moves", () => {
		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: [makeClick(5_000)],
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(1);
		expect(result.suggestions[0].end - result.suggestions[0].start).toBe(DEFAULT_DURATION_MS);
	});

	it.each(["right-click", "middle-click"] as const)(
		"accepts %s telemetry like a standard click",
		(interactionType) => {
			const result = buildInteractionZoomSuggestions({
				cursorTelemetry: withMoves([makeClick(5_000, 0.5, 0.5, interactionType)], TOTAL_MS),
				totalMs: TOTAL_MS,
				defaultDurationMs: DEFAULT_DURATION_MS,
			});

			expect(result.status).toBe("ok");
			expect(result.suggestions).toHaveLength(1);

			const [suggestion] = result.suggestions;
			expect(suggestion.end - suggestion.start).toBe(DEFAULT_DURATION_MS);
			expect(suggestion.start).toBe(5_000 - DEFAULT_DURATION_MS / 2);
			expect(suggestion.end).toBe(5_000 + DEFAULT_DURATION_MS / 2);
		},
	);

	it("merges two clicks within 2500ms into one zoom track spanning the cluster plus padding", () => {
		const firstClick = 4_000;
		const lastClick = 4_000 + CLICK_CLUSTER_MERGE_GAP_MS - 1;
		const telemetry = withMoves([makeClick(firstClick), makeClick(lastClick)], TOTAL_MS);

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(1);

		const [s] = result.suggestions;
		const expectedDuration = lastClick - firstClick + CLICK_CLUSTER_PAD_MS * 2;
		expect(s.end - s.start).toBe(expectedDuration);
		expect(s.start).toBe(firstClick - CLICK_CLUSTER_PAD_MS);
		expect(s.end).toBe(lastClick + CLICK_CLUSTER_PAD_MS);
	});

	it("splits two clicks more than 2500ms apart into separate zoom tracks when both fit", () => {
		const click1 = 3_000;
		const click2 = 12_000; // far enough that default-duration windows do not collide

		const telemetry = withMoves([makeClick(click1), makeClick(click2)], TOTAL_MS);

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(2);

		const [a, b] = result.suggestions;
		expect(a.end - a.start).toBe(DEFAULT_DURATION_MS);
		expect(b.end - b.start).toBe(DEFAULT_DURATION_MS);
		expect(a.start).toBe(click1 - DEFAULT_DURATION_MS / 2);
		expect(a.end).toBe(click1 + DEFAULT_DURATION_MS / 2);
		expect(b.start).toBe(click2 - DEFAULT_DURATION_MS / 2);
		expect(b.end).toBe(click2 + DEFAULT_DURATION_MS / 2);
	});

	it("does not merge clicks more than 2500ms apart even if only one slot remains free", () => {
		const click1 = 3_000;
		const click2 = 3_000 + CLICK_CLUSTER_MERGE_GAP_MS + 1;

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves([makeClick(click1), makeClick(click2)], TOTAL_MS),
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		// Windows of 3000ms centered only 2501ms apart overlap, so the later cluster is skipped.
		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(1);
		expect(result.suggestions[0].start).toBe(click1 - DEFAULT_DURATION_MS / 2);
		expect(result.suggestions[0].end).toBe(click1 + DEFAULT_DURATION_MS / 2);
	});

	it("chains multiple clicks: 3 in a row within 2500ms each become one track", () => {
		// click at 0, 2000, 4000 — each gap is 2000ms < 2500ms
		const telemetry = withMoves([makeClick(0), makeClick(2_000), makeClick(4_000)], TOTAL_MS);

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(1);

		const [s] = result.suggestions;
		// Interaction span + pad is larger than defaultDurationMs; shift into media bounds.
		// Unclamped window is [-500, 4500] (5000ms); shifted to preserve duration => [0, 5000].
		expect(s.start).toBe(0);
		expect(s.end).toBe(5_000);
		expect(s.end - s.start).toBeGreaterThanOrEqual(4_000 + CLICK_CLUSTER_PAD_MS);
	});

	it("returns no-interactions when there are no click telemetry points", () => {
		// Move events only — no clicks
		const telemetry: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.5, cy: 0.5, interactionType: "move" },
			{ timeMs: 1_000, cx: 0.5, cy: 0.5, interactionType: "move" },
			{ timeMs: 2_000, cx: 0.6, cy: 0.6, interactionType: "move" },
			{ timeMs: TOTAL_MS, cx: 0.6, cy: 0.6, interactionType: "move" },
		];

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		expect(result.status).toBe("no-interactions");
		expect(result.suggestions).toHaveLength(0);
	});

	it("ignores dwell-derived click-like heuristics when there are no explicit clicks", () => {
		const telemetry: CursorTelemetryPoint[] = [
			makeMove(0, 0.5, 0.5),
			makeMove(200, 0.5005, 0.5005),
			makeMove(400, 0.5008, 0.5008),
			makeMove(600, 0.501, 0.501),
		];

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		expect(result.status).toBe("no-interactions");
		expect(result.suggestions).toHaveLength(0);
	});

	it("skips clusters that overlap reserved spans", () => {
		const click = 5_000;

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves([makeClick(click)], TOTAL_MS),
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
			reservedSpans: [{ start: 4_000, end: 6_000 }], // overlaps the cluster window
		});

		expect(result.status).toBe("no-slots");
		expect(result.suggestions).toHaveLength(0);
	});

	it("respects spacingMs between reserved zooms and new suggestions", () => {
		const click = 8_000;

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves([makeClick(click)], TOTAL_MS),
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
			reservedSpans: [{ start: 4_000, end: 5_000 }],
			spacingMs: 2_000,
		});

		// desired window is [6500, 9500]; with 2000ms spacing it collides with reserved end 5000
		expect(result.status).toBe("no-slots");
		expect(result.suggestions).toHaveLength(0);
	});

	it("keeps newly generated suggestions non-overlapping and chronological", () => {
		const telemetry = withMoves([makeClick(5_000), makeClick(12_000)], TOTAL_MS);

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: telemetry,
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
			spacingMs: 100,
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(2);
		const [a, b] = result.suggestions;
		expect(a.start).toBeLessThan(b.start);
		expect(a.end + 100).toBeLessThanOrEqual(b.start);
	});

	it("clamps and shifts windows to media bounds while preserving defaultDuration when possible", () => {
		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves([makeClick(200)], 5_000),
			totalMs: 5_000,
			defaultDurationMs: DEFAULT_DURATION_MS,
		});

		expect(result.status).toBe("ok");
		const [s] = result.suggestions;
		expect(s.start).toBe(0);
		expect(s.end).toBe(DEFAULT_DURATION_MS);
		expect(s.end - s.start).toBe(DEFAULT_DURATION_MS);
	});

	it("treats empty clips as the full media span for backwards compatibility", () => {
		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves([makeClick(5_000)], TOTAL_MS),
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
			clips: [],
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(1);
		expect(result.suggestions[0].end - result.suggestions[0].start).toBe(DEFAULT_DURATION_MS);
	});

	it("contains each suggestion within a single retained clip and skips gap clusters", () => {
		const clips = [
			{ startMs: 0, endMs: 8_000 },
			{ startMs: 12_000, endMs: 20_000 },
		];

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves(
				[
					makeClick(4_000), // inside first clip
					makeClick(10_000), // in removed gap
					makeClick(14_000), // second clip
				],
				TOTAL_MS,
			),
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
			clips,
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions).toHaveLength(2);
		for (const suggestion of result.suggestions) {
			const containing = clips.filter(
				(clip) => suggestion.start >= clip.startMs && suggestion.end <= clip.endMs,
			);
			expect(containing).toHaveLength(1);
		}
		expect(result.suggestions.some((s) => s.start < 8_000 && s.end > 12_000)).toBe(false);
	});

	it("skips a multi-click cluster that would bridge a removed gap", () => {
		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves(
				// gap between clicks is < merge gap, but they live in different retained clips
				[makeClick(7_000), makeClick(7_000 + 2_000)],
				TOTAL_MS,
			),
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
			clips: [
				{ startMs: 0, endMs: 8_000 },
				{ startMs: 8_500, endMs: 20_000 },
			],
		});

		expect(result.status).toBe("no-slots");
		expect(result.suggestions).toHaveLength(0);
	});

	it("skips suggestions that cannot fit the required duration inside the active clip", () => {
		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves([makeClick(1_000)], TOTAL_MS),
			totalMs: TOTAL_MS,
			defaultDurationMs: DEFAULT_DURATION_MS,
			clips: [{ startMs: 0, endMs: 2_000 }], // only 2000ms available, need 3000
		});

		expect(result.status).toBe("no-slots");
		expect(result.suggestions).toHaveLength(0);
	});

	it("uses pad-only duration when it already exceeds defaultDurationMs", () => {
		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: withMoves([makeClick(5_000)], TOTAL_MS),
			totalMs: TOTAL_MS,
			defaultDurationMs: 200, // smaller than pad*2
		});

		expect(result.status).toBe("ok");
		const [s] = result.suggestions;
		expect(s.end - s.start).toBe(CLICK_CLUSTER_PAD_MS * 2);
		expect(s.start).toBe(5_000 - CLICK_CLUSTER_PAD_MS);
		expect(s.end).toBe(5_000 + CLICK_CLUSTER_PAD_MS);
	});
});
