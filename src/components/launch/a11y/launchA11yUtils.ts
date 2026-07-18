export interface LaunchMediaA11yState {
	reduceMotion: boolean;
	reduceTransparency: boolean;
	highContrast: boolean;
	forcedColors: boolean;
}

export type MatchMediaLike = (query: string) => {
	matches: boolean;
	media: string;
	onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null;
	addEventListener: (
		type: "change",
		listener: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown,
		options?: boolean | AddEventListenerOptions,
	) => void;
	removeEventListener: (
		type: "change",
		listener: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown,
		options?: boolean | EventListenerOptions,
	) => void;
	dispatchEvent: (event: Event) => boolean;
};

export function getInitialLaunchMediaA11yState(
	matchMedia: MatchMediaLike | undefined = typeof window !== "undefined"
		? window.matchMedia
		: undefined,
): LaunchMediaA11yState {
	if (!matchMedia) {
		return {
			reduceMotion: false,
			reduceTransparency: false,
			highContrast: false,
			forcedColors: false,
		};
	}

	return {
		reduceMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
		reduceTransparency: matchMedia("(prefers-reduced-transparency: reduce)").matches,
		highContrast: matchMedia("(prefers-contrast: more)").matches,
		forcedColors: matchMedia("(forced-colors: active)").matches,
	};
}

export function subscribeLaunchMediaA11y(
	callback: (state: LaunchMediaA11yState) => void,
	matchMedia: MatchMediaLike | undefined = typeof window !== "undefined"
		? window.matchMedia
		: undefined,
): () => void {
	if (!matchMedia) {
		return () => undefined;
	}

	const queries = {
		reduceMotion: matchMedia("(prefers-reduced-motion: reduce)"),
		reduceTransparency: matchMedia("(prefers-reduced-transparency: reduce)"),
		highContrast: matchMedia("(prefers-contrast: more)"),
		forcedColors: matchMedia("(forced-colors: active)"),
	};

	const update = () => {
		callback({
			reduceMotion: queries.reduceMotion.matches,
			reduceTransparency: queries.reduceTransparency.matches,
			highContrast: queries.highContrast.matches,
			forcedColors: queries.forcedColors.matches,
		});
	};

	for (const query of Object.values(queries)) {
		query.addEventListener("change", update);
	}
	update();

	return () => {
		for (const query of Object.values(queries)) {
			query.removeEventListener("change", update);
		}
	};
}

export function computeLaunchA11yDataAttributes(
	state: LaunchMediaA11yState,
): Record<string, string> {
	return {
		"data-reduce-motion": String(state.reduceMotion),
		"data-reduce-transparency": String(state.reduceTransparency),
		"data-high-contrast": String(state.highContrast || state.forcedColors),
	};
}

export function formatLaunchHudTitle(
	state: "idle" | "recording" | "finalizing",
	paused: boolean,
	elapsed: string,
): string {
	if (state === "finalizing") return "Finalizing recording";
	if (state === "recording") return paused ? `Paused at ${elapsed}` : `Recording ${elapsed}`;
	return "Aureo recorder";
}
