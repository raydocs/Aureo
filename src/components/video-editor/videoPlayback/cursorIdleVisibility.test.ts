import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import {
	buildCursorActivityTimeline,
	DEFAULT_CURSOR_IDLE_TIMEOUT_MS,
	isCursorActiveAtTime,
} from "./cursorIdleVisibility";

describe("cursor idle visibility", () => {
	it("ignores continuously sampled stationary points", () => {
		const samples: CursorTelemetryPoint[] = [0, 400, 800, 1_200].map((timeMs) => ({
			timeMs,
			cx: 0.5,
			cy: 0.5,
			interactionType: "move",
		}));

		expect(buildCursorActivityTimeline(samples)).toEqual([0]);
		expect(isCursorActiveAtTime([0], DEFAULT_CURSOR_IDLE_TIMEOUT_MS - 1)).toBe(true);
		expect(isCursorActiveAtTime([0], DEFAULT_CURSOR_IDLE_TIMEOUT_MS)).toBe(false);
	});

	it("reactivates on meaningful movement and stationary pointer clicks", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.5, cy: 0.5, interactionType: "move" },
			{ timeMs: 500, cx: 0.5002, cy: 0.5, interactionType: "move" },
			{ timeMs: 900, cx: 0.501, cy: 0.5, interactionType: "move" },
			{ timeMs: 2_500, cx: 0.501, cy: 0.5, interactionType: "click" },
		];

		expect(buildCursorActivityTimeline(samples)).toEqual([0, 900, 2_500]);
		expect(isCursorActiveAtTime([0, 900, 2_500], 2_499)).toBe(false);
		expect(isCursorActiveAtTime([0, 900, 2_500], 2_500)).toBe(true);
	});

	it("handles unsorted and invalid samples without mutating the input", () => {
		const samples: CursorTelemetryPoint[] = [
			{ timeMs: 1_000, cx: 0.6, cy: 0.5 },
			{ timeMs: Number.NaN, cx: 0.2, cy: 0.2 },
			{ timeMs: 0, cx: 0.5, cy: 0.5 },
		];
		const original = [...samples];

		expect(buildCursorActivityTimeline(samples)).toEqual([0, 1_000]);
		expect(samples).toEqual(original);
		expect(isCursorActiveAtTime([], 0)).toBe(false);
		expect(isCursorActiveAtTime([0], -1)).toBe(false);
	});
});
