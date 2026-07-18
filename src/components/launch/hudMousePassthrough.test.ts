import { describe, expect, it, vi } from "vitest";

import {
	HUD_INTERACTIVE_TARGET_SELECTOR,
	isHudInteractiveTarget,
	mergeHudInteractiveBounds,
	shouldRestoreHudMousePassthroughAfterDrag,
} from "./hudMousePassthrough";

const hudBounds = { left: 100, top: 200, right: 300, bottom: 260 };

function createClosestTarget(match: boolean) {
	return {
		closest: vi.fn((selector: string) => {
			expect(selector).toBe(HUD_INTERACTIVE_TARGET_SELECTOR);
			return match ? {} : null;
		}),
	} as unknown as EventTarget;
}

describe("isHudInteractiveTarget", () => {
	it("returns false for non-element targets", () => {
		expect(isHudInteractiveTarget(null)).toBe(false);
		expect(isHudInteractiveTarget(undefined)).toBe(false);
		expect(isHudInteractiveTarget({} as EventTarget)).toBe(false);
	});

	it("returns true for explicit HUD interactive regions", () => {
		const target = createClosestTarget(true);
		expect(isHudInteractiveTarget(target)).toBe(true);
		expect((target as { closest: ReturnType<typeof vi.fn> }).closest).toHaveBeenCalledWith(
			"[data-hud-interactive], [data-radix-popper-content-wrapper]",
		);
	});

	it("returns true for Radix popper content wrappers", () => {
		// Same selector covers both explicit HUD chrome and Radix poppers.
		expect(isHudInteractiveTarget(createClosestTarget(true))).toBe(true);
	});

	it("ignores generic pointer-events-auto layout classes", () => {
		// Closest only matches explicit interactive selectors, never layout classes.
		const target = createClosestTarget(false);
		expect(isHudInteractiveTarget(target)).toBe(false);
		expect(HUD_INTERACTIVE_TARGET_SELECTOR).not.toContain("pointer-events-auto");
	});
});

describe("mergeHudInteractiveBounds", () => {
	it("returns null when there are no interactive bounds", () => {
		expect(mergeHudInteractiveBounds([null, undefined])).toBeNull();
	});

	it("merges the dropdown, bar, and webcam preview bounds", () => {
		expect(
			mergeHudInteractiveBounds([
				{ left: 120, top: 220, right: 260, bottom: 320 },
				{ left: 100, top: 200, right: 300, bottom: 260 },
				{ left: 140, top: 280, right: 340, bottom: 430 },
			]),
		).toEqual({ left: 100, top: 200, right: 340, bottom: 430 });
	});
});

describe("shouldRestoreHudMousePassthroughAfterDrag", () => {
	it("keeps the HUD interactive when the pointer is still inside the HUD", () => {
		expect(shouldRestoreHudMousePassthroughAfterDrag(hudBounds, 180, 230)).toBe(false);
	});

	it("keeps the HUD interactive when the pointer ends on the HUD edge", () => {
		expect(shouldRestoreHudMousePassthroughAfterDrag(hudBounds, 100, 200)).toBe(false);
		expect(shouldRestoreHudMousePassthroughAfterDrag(hudBounds, 300, 260)).toBe(false);
	});

	it("restores passthrough when the pointer ends outside the HUD", () => {
		expect(shouldRestoreHudMousePassthroughAfterDrag(hudBounds, 99, 230)).toBe(true);
		expect(shouldRestoreHudMousePassthroughAfterDrag(hudBounds, 180, 199)).toBe(true);
		expect(shouldRestoreHudMousePassthroughAfterDrag(hudBounds, 301, 230)).toBe(true);
		expect(shouldRestoreHudMousePassthroughAfterDrag(hudBounds, 180, 261)).toBe(true);
	});

	it("restores passthrough when no HUD bounds are available", () => {
		expect(shouldRestoreHudMousePassthroughAfterDrag(null, 180, 230)).toBe(true);
	});
});
