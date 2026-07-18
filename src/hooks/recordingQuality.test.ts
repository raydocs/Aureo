import { describe, expect, it, vi } from "vitest";
import {
	computeRecordingBitrate,
	DEFAULT_RECORDING_QUALITY_PRESET_ID,
	getRecordingQualityPreset,
	loadRecordingQualityPreset,
	saveRecordingQualityPreset,
} from "./recordingQuality";

describe("recording quality presets", () => {
	it("preserves the existing 4K 60 FPS behavior by default", () => {
		expect(getRecordingQualityPreset(DEFAULT_RECORDING_QUALITY_PRESET_ID)).toMatchObject({
			maxWidth: 3840,
			maxHeight: 2160,
			frameRate: 60,
		});
	});

	it("falls back to Ultra for an unknown preset", () => {
		expect(getRecordingQualityPreset("unknown" as never).id).toBe("ultra");
	});

	it("scales bitrate with resolution and frame rate", () => {
		expect(computeRecordingBitrate(1920, 1080, 30)).toBe(18_000_000);
		expect(computeRecordingBitrate(2560, 1440, 60)).toBe(47_600_000);
		expect(computeRecordingBitrate(3840, 2160, 60)).toBe(76_500_000);
	});

	it("persists only known preset identifiers", () => {
		const values = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		});

		saveRecordingQualityPreset("high");
		expect(loadRecordingQualityPreset()).toBe("high");

		values.set("aureo.recording.qualityPreset", "invalid");
		expect(loadRecordingQualityPreset()).toBe(DEFAULT_RECORDING_QUALITY_PRESET_ID);

		vi.unstubAllGlobals();
	});
});
