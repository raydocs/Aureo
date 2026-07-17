import { describe, expect, it } from "vitest";

import type { CursorTelemetryPoint } from "../types";
import { forceDefaultCursorType, optimizeOriginalCursorTypes } from "./cursorTypeOptimization";

function point(
	timeMs: number,
	cursorType: CursorTelemetryPoint["cursorType"],
	interactionType: CursorTelemetryPoint["interactionType"] = "move",
): CursorTelemetryPoint {
	return { timeMs, cx: timeMs / 1_000, cy: 0.5, cursorType, interactionType };
}

describe("optimizeOriginalCursorTypes", () => {
	it("collapses a brief cursor-type bounce", () => {
		const result = optimizeOriginalCursorTypes([
			point(0, "arrow"),
			point(40, "text"),
			point(80, "text"),
			point(120, "arrow"),
		]);

		expect(result).toMatchObject({ optimizedRunCount: 1, replacedPointCount: 2 });
		expect(result.points.map(({ cursorType }) => cursorType)).toEqual([
			"arrow",
			"arrow",
			"arrow",
			"arrow",
		]);
	});

	it("preserves a sustained or deliberate cursor-type change", () => {
		const sustained = [point(0, "arrow"), point(40, "text"), point(260, "arrow")];
		const deliberate = [point(0, "arrow"), point(40, "pointer", "click"), point(80, "arrow")];

		expect(optimizeOriginalCursorTypes(sustained).optimizedRunCount).toBe(0);
		expect(optimizeOriginalCursorTypes(deliberate).optimizedRunCount).toBe(0);
	});

	it("uses the last known type for samples without an explicit type", () => {
		const result = optimizeOriginalCursorTypes([
			point(0, "arrow"),
			point(30, "text"),
			point(60, undefined),
			point(90, "arrow"),
		]);

		expect(result.optimizedRunCount).toBe(1);
		expect(result.points[2].cursorType).toBe("arrow");
	});
});

describe("forceDefaultCursorType", () => {
	it("forces the default variant while preserving motion and interactions", () => {
		const samples = [point(0, "text"), point(50, "pointer", "click")];
		const result = forceDefaultCursorType(samples);

		expect(result.map(({ cursorType }) => cursorType)).toEqual(["arrow", "arrow"]);
		expect(result[1]).toMatchObject({ timeMs: 50, cx: 0.05, interactionType: "click" });
		expect(samples[0].cursorType).toBe("text");
	});
});
