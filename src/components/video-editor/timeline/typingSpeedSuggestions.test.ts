import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import { suggestTypingSpeedRegions } from "./typingSpeedSuggestions";

function key(timeMs: number): CursorTelemetryPoint {
	return { timeMs, cx: 0.5, cy: 0.5, interactionType: "key" };
}

describe("suggestTypingSpeedRegions", () => {
	it("groups sustained privacy-safe key timestamps into speed suggestions", () => {
		const result = suggestTypingSpeedRegions(
			[key(1_000), key(1_200), key(1_500), key(1_900), key(7_000), key(7_300)],
			{ totalMs: 10_000 },
		);

		expect(result).toEqual({
			status: "ready",
			suggestions: [{ startMs: 700, endMs: 2_400, keyCount: 4, speed: 2 }],
		});
	});

	it("can restrict detection to the selected clip window", () => {
		const result = suggestTypingSpeedRegions(
			[
				key(500),
				key(700),
				key(900),
				key(1_100),
				key(5_000),
				key(5_200),
				key(5_400),
				key(5_600),
			],
			{ totalMs: 8_000, window: { startMs: 4_000, endMs: 7_000 } },
		);

		expect(result.status).toBe("ready");
		if (result.status === "ready") {
			expect(result.suggestions).toEqual([
				{ startMs: 4_650, endMs: 6_150, keyCount: 4, speed: 2 },
			]);
		}
	});

	it("does not create overlapping speed regions", () => {
		const result = suggestTypingSpeedRegions([key(1_000), key(1_200), key(1_400), key(1_600)], {
			totalMs: 4_000,
			existingRegions: [{ startMs: 1_300, endMs: 2_000 }],
		});

		expect(result).toEqual({ status: "no-typing", suggestions: [] });
	});

	it("distinguishes absent key telemetry from sparse typing", () => {
		expect(
			suggestTypingSpeedRegions(
				[{ timeMs: 1_000, cx: 0.2, cy: 0.3, interactionType: "click" }],
				{ totalMs: 4_000 },
			),
		).toEqual({ status: "no-telemetry", suggestions: [] });

		expect(suggestTypingSpeedRegions([key(1_000), key(1_500)], { totalMs: 4_000 })).toEqual({
			status: "no-typing",
			suggestions: [],
		});
	});
});
