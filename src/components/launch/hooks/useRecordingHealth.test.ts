import { describe, expect, it } from "vitest";
import { formatAvailableStorage } from "./useRecordingHealth";

describe("formatAvailableStorage", () => {
	it("formats large volumes as rounded gigabytes", () => {
		expect(formatAvailableStorage(128 * 1024 ** 3)).toBe("128 GB free");
	});

	it("keeps one decimal place below ten gigabytes", () => {
		expect(formatAvailableStorage(1.75 * 1024 ** 3)).toBe("1.8 GB free");
	});

	it("handles unavailable probes", () => {
		expect(formatAvailableStorage(null)).toBe("Unknown");
		expect(formatAvailableStorage(Number.NaN)).toBe("Unknown");
	});
});
