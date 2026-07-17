import { describe, expect, it } from "vitest";

import type { CursorTelemetryPoint } from "../types";
import { removeCursorShakes } from "./cursorShakeRemoval";

function point(timeMs: number, cx: number, cy = 0.5): CursorTelemetryPoint {
	return { timeMs, cx, cy, interactionType: "move", cursorType: "arrow" };
}

describe("removeCursorShakes", () => {
	it("replaces a short out-and-back excursion without changing sample metadata", () => {
		const samples = [
			point(0, 0.4),
			{ ...point(30, 0.46), cursorType: "pointer" as const },
			point(60, 0.401),
			point(180, 0.44),
		];

		const result = removeCursorShakes(samples);

		expect(result.shakeCount).toBe(1);
		expect(result.replacedPointCount).toBe(1);
		expect(result.points[1]).toMatchObject({
			timeMs: 30,
			cursorType: "pointer",
			interactionType: "move",
		});
		expect(result.points[1].cx).toBeCloseTo(0.4005, 5);
		expect(samples[1].cx).toBe(0.46);
	});

	it("cleans a multi-sample synthetic shake as one excursion", () => {
		const result = removeCursorShakes([
			point(0, 0.5),
			point(20, 0.53),
			point(40, 0.56),
			point(70, 0.501),
			point(200, 0.58),
		]);

		expect(result).toMatchObject({ shakeCount: 1, replacedPointCount: 2 });
		expect(result.points[1].cx).toBeLessThan(0.501);
		expect(result.points[2].cx).toBeLessThan(0.501);
	});

	it("preserves deliberate monotonic movement and long returns", () => {
		const monotonic = [point(0, 0.2), point(30, 0.25), point(60, 0.3), point(90, 0.35)];
		const slowReturn = [point(0, 0.4), point(30, 0.48), point(220, 0.401)];

		expect(removeCursorShakes(monotonic)).toEqual({
			points: monotonic,
			shakeCount: 0,
			replacedPointCount: 0,
		});
		expect(removeCursorShakes(slowReturn).shakeCount).toBe(0);
	});

	it("does not rewrite click coordinates inside an excursion", () => {
		const samples = [
			point(0, 0.4),
			{ ...point(30, 0.46), interactionType: "click" as const, pressure: 1 },
			point(60, 0.401),
		];

		expect(removeCursorShakes(samples)).toEqual({
			points: samples,
			shakeCount: 0,
			replacedPointCount: 0,
		});
	});
});
