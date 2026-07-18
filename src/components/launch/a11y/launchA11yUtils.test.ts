import { describe, expect, it, vi } from "vitest";
import {
	computeLaunchA11yDataAttributes,
	formatLaunchHudTitle,
	getInitialLaunchMediaA11yState,
} from "./launchA11yUtils";

function createMatchMedia(queryMap: Record<string, boolean>) {
	return vi.fn((query: string) => ({
		matches: queryMap[query] ?? false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}));
}

describe("getInitialLaunchMediaA11yState", () => {
	it("returns false flags when matchMedia is unavailable", () => {
		expect(getInitialLaunchMediaA11yState(undefined)).toEqual({
			reduceMotion: false,
			reduceTransparency: false,
			highContrast: false,
			forcedColors: false,
		});
	});

	it("returns true flags when media queries match", () => {
		const result = getInitialLaunchMediaA11yState(
			createMatchMedia({
				"(prefers-reduced-motion: reduce)": true,
				"(prefers-reduced-transparency: reduce)": true,
				"(prefers-contrast: more)": true,
				"(forced-colors: active)": true,
			}),
		);
		expect(result).toEqual({
			reduceMotion: true,
			reduceTransparency: true,
			highContrast: true,
			forcedColors: true,
		});
	});

	it("returns false flags when media queries do not match", () => {
		const result = getInitialLaunchMediaA11yState(createMatchMedia({}));
		expect(result).toEqual({
			reduceMotion: false,
			reduceTransparency: false,
			highContrast: false,
			forcedColors: false,
		});
	});
});

describe("computeLaunchA11yDataAttributes", () => {
	it("sets data-high-contrast when either high contrast or forced colors is active", () => {
		expect(
			computeLaunchA11yDataAttributes({
				reduceMotion: false,
				reduceTransparency: false,
				highContrast: true,
				forcedColors: false,
			}),
		).toEqual({
			"data-reduce-motion": "false",
			"data-reduce-transparency": "false",
			"data-high-contrast": "true",
		});
	});

	it("sets data-high-contrast from forced colors as well", () => {
		expect(
			computeLaunchA11yDataAttributes({
				reduceMotion: true,
				reduceTransparency: true,
				highContrast: false,
				forcedColors: true,
			}),
		).toEqual({
			"data-reduce-motion": "true",
			"data-reduce-transparency": "true",
			"data-high-contrast": "true",
		});
	});
});

describe("formatLaunchHudTitle", () => {
	it("describes finalizing state", () => {
		expect(formatLaunchHudTitle("finalizing", false, "01:23")).toBe("Finalizing recording");
	});

	it("describes paused recording with elapsed time", () => {
		expect(formatLaunchHudTitle("recording", true, "01:23")).toBe("Paused at 01:23");
	});

	it("describes active recording with elapsed time", () => {
		expect(formatLaunchHudTitle("recording", false, "01:23")).toBe("Recording 01:23");
	});

	it("describes idle state", () => {
		expect(formatLaunchHudTitle("idle", false, "00:00")).toBe("Aureo recorder");
	});
});
