import { describe, expect, it } from "vitest";
import { getVoiceEnhancementFilters, normalizeVoiceEnhancementMode } from "./voiceEnhancement";

describe("voice enhancement", () => {
	it("defaults unknown preference values to standard", () => {
		expect(normalizeVoiceEnhancementMode(undefined)).toBe("standard");
		expect(normalizeVoiceEnhancementMode("strong")).toBe("strong");
		expect(normalizeVoiceEnhancementMode("off")).toBe("off");
	});

	it("uses RNNoise and adds stronger residual-noise cleanup in strong mode", () => {
		const standard = getVoiceEnhancementFilters("standard", "/tmp/model.rnnn");
		const strong = getVoiceEnhancementFilters("strong", "/tmp/model.rnnn");
		expect(standard.join(",")).toContain("arnndn=");
		expect(standard.join(",")).not.toContain("afftdn=");
		expect(strong.join(",")).toContain("arnndn=");
		expect(strong.join(",")).toContain("afftdn=");
	});

	it("returns no filters when cleanup is disabled", () => {
		expect(getVoiceEnhancementFilters("off", "/tmp/model.rnnn")).toEqual([]);
	});
});
