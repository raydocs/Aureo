export interface HudInteractiveBounds {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export const HUD_INTERACTIVE_TARGET_SELECTOR =
	"[data-hud-interactive], [data-radix-popper-content-wrapper]";

type ClosestCapable = {
	closest: (selectors: string) => unknown;
};

function hasClosest(target: unknown): target is ClosestCapable {
	return (
		typeof target === "object" &&
		target !== null &&
		"closest" in target &&
		typeof (target as ClosestCapable).closest === "function"
	);
}

export function isHudInteractiveTarget(target: EventTarget | null | undefined): boolean {
	if (!hasClosest(target)) {
		return false;
	}

	return Boolean(target.closest(HUD_INTERACTIVE_TARGET_SELECTOR));
}

export function mergeHudInteractiveBounds(
	bounds: Array<HudInteractiveBounds | null | undefined>,
): HudInteractiveBounds | null {
	const presentBounds = bounds.filter((value): value is HudInteractiveBounds => Boolean(value));
	if (presentBounds.length === 0) {
		return null;
	}

	return presentBounds.reduce((merged, current) => ({
		left: Math.min(merged.left, current.left),
		top: Math.min(merged.top, current.top),
		right: Math.max(merged.right, current.right),
		bottom: Math.max(merged.bottom, current.bottom),
	}));
}

export function shouldRestoreHudMousePassthroughAfterDrag(
	bounds: HudInteractiveBounds | null,
	clientX: number,
	clientY: number,
): boolean {
	if (!bounds) {
		return true;
	}

	return (
		clientX < bounds.left ||
		clientX > bounds.right ||
		clientY < bounds.top ||
		clientY > bounds.bottom
	);
}
