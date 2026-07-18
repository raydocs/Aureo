import { describe, expect, it, vi } from "vitest";
import { getInitialLaunchMediaA11yState } from "../a11y/launchA11yUtils";

describe("useLaunchMediaA11y data attribute derivation", () => {
	it("derives the correct initial data attributes from mocked media queries", () => {
		const mockMatchMedia = vi.fn((query: string) => ({
			matches: query === "(forced-colors: active)",
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		globalThis.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

		const state = getInitialLaunchMediaA11yState(mockMatchMedia);
		expect(state).toEqual({
			reduceMotion: false,
			reduceTransparency: false,
			highContrast: false,
			forcedColors: true,
		});
	});
});
