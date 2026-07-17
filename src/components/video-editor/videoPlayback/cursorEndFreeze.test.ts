import { describe, expect, it } from "vitest";

import type { CursorTelemetryPoint } from "../types";
import { stopCursorMovementAtEnd } from "./cursorEndFreeze";

const point = (
	timeMs: number,
	cx: number,
	cy: number,
	interactionType: CursorTelemetryPoint["interactionType"] = "move",
): CursorTelemetryPoint => ({ timeMs, cx, cy, interactionType, cursorType: "arrow" });

describe("stopCursorMovementAtEnd", () => {
	it("freezes the final 900ms at an interpolated position", () => {
		const result = stopCursorMovementAtEnd(
			[
				point(0, 0.1, 0.2),
				point(8_000, 0.3, 0.4),
				point(9_500, 0.9, 0.8, "click"),
				point(10_000, 1, 1),
			],
			10_000,
		);

		expect(result.freezeStartMs).toBe(9_100);
		expect(result.removedPointCount).toBe(2);
		expect(result.points.at(-2)).toMatchObject({
			timeMs: 9_100,
			cx: 0.74,
			cy: 0.6933333333333334,
			interactionType: "move",
		});
		expect(result.points.at(-1)).toMatchObject({
			timeMs: 10_000,
			cx: 0.74,
			cy: 0.6933333333333334,
			interactionType: "move",
		});
	});

	it("uses one quarter of a short clip without freezing most of it", () => {
		const result = stopCursorMovementAtEnd(
			[point(0, 0, 0), point(1_000, 0.5, 0.5), point(2_000, 1, 1)],
			2_000,
		);

		expect(result.freezeStartMs).toBe(1_500);
		expect(result.points.at(-2)).toMatchObject({ timeMs: 1_500, cx: 0.75, cy: 0.75 });
		expect(result.points.at(-1)).toMatchObject({ timeMs: 2_000, cx: 0.75, cy: 0.75 });
	});

	it("preserves telemetry outside a trimmed display window", () => {
		const result = stopCursorMovementAtEnd(
			[
				point(0, 0, 0),
				point(1_000, 0.1, 0.1),
				point(4_500, 0.5, 0.5),
				point(5_000, 0.8, 0.8),
				point(6_000, 1, 1),
			],
			5_000,
			1_000,
		);

		expect(result.freezeStartMs).toBe(4_100);
		expect(result.points.at(-1)).toEqual(point(6_000, 1, 1));
		expect(result.points.find((sample) => sample.timeMs === 5_000)).toMatchObject({
			cx: 0.4542857142857143,
			cy: 0.4542857142857143,
		});
	});

	it("leaves very short or insufficient telemetry unchanged", () => {
		const samples = [point(0, 0, 0), point(300, 1, 1)];
		expect(stopCursorMovementAtEnd(samples, 300)).toEqual({
			points: samples,
			freezeStartMs: null,
			removedPointCount: 0,
		});
		expect(stopCursorMovementAtEnd([samples[0]], 2_000).points).toEqual([samples[0]]);
	});
});
