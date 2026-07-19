export const RECORDER_UI_STATES = [
	"idle",
	"countdown",
	"recording",
	"paused",
	"finalizing",
] as const;

export type RecorderUiState = (typeof RECORDER_UI_STATES)[number];
export type RecorderMenuCommand = "pause" | "resume" | "stop" | "restart" | "cancel";

export function getRecorderMenuConfirmation(command: RecorderMenuCommand): {
	confirmLabel: string;
	message: string;
	detail: string;
} | null {
	if (command === "restart") {
		return {
			confirmLabel: "Restart Recording",
			message: "Restart the current recording?",
			detail: "The current recording will be deleted and a new recording will start with the same capture settings.",
		};
	}
	if (command === "cancel") {
		return {
			confirmLabel: "Delete Recording",
			message: "Delete the current recording?",
			detail: "This stops the recording and permanently deletes the captured media.",
		};
	}
	return null;
}

export function isRecorderUiState(value: unknown): value is RecorderUiState {
	return RECORDER_UI_STATES.includes(value as RecorderUiState);
}

export function isActiveRecorderUiState(state: RecorderUiState): boolean {
	return state === "recording" || state === "paused";
}

export function resolveRecorderUiState(state: {
	recording: boolean;
	paused: boolean;
	countdownActive: boolean;
	finalizing: boolean;
}): RecorderUiState {
	if (state.finalizing) return "finalizing";
	if (state.countdownActive) return "countdown";
	if (!state.recording) return "idle";
	return state.paused ? "paused" : "recording";
}
