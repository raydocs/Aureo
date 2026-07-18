import { useEffect, useState } from "react";
import {
	computeLaunchA11yDataAttributes,
	getInitialLaunchMediaA11yState,
	type LaunchMediaA11yState,
	subscribeLaunchMediaA11y,
} from "../a11y/launchA11yUtils";

export function useLaunchMediaA11y(): {
	state: LaunchMediaA11yState;
	dataAttributes: Record<string, string>;
} {
	const [state, setState] = useState<LaunchMediaA11yState>(() =>
		getInitialLaunchMediaA11yState(),
	);

	useEffect(() => {
		return subscribeLaunchMediaA11y(setState);
	}, []);

	return { state, dataAttributes: computeLaunchA11yDataAttributes(state) };
}
