import { describe, expect, it } from "vitest";

import { advanceMeterLevel } from "./useMicrophoneLevel";

describe("advanceMeterLevel", () => {
	it("attacks halfway toward a rising target", () => {
		expect(advanceMeterLevel(0.2, 0.8)).toBeCloseTo(0.5);
	});

	it("decays eight percent toward a falling target", () => {
		expect(advanceMeterLevel(0.8, 0.3)).toBeCloseTo(0.76);
	});

	it("clamps inputs and output to the meter range", () => {
		expect(advanceMeterLevel(-1, 2)).toBe(0.5);
		expect(advanceMeterLevel(2, -1)).toBeCloseTo(0.92);
	});
});
