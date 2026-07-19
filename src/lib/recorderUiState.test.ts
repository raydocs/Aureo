import { describe, expect, it } from "vitest";
import {
	getRecorderMenuConfirmation,
	isActiveRecorderUiState,
	isRecorderUiState,
	resolveRecorderUiState,
} from "./recorderUiState";

describe("getRecorderMenuConfirmation", () => {
	it("requires explicit confirmation before restarting or deleting an active recording", () => {
		expect(getRecorderMenuConfirmation("restart")).toEqual({
			confirmLabel: "Restart Recording",
			message: "Restart the current recording?",
			detail: "The current recording will be deleted and a new recording will start with the same capture settings.",
		});
		expect(getRecorderMenuConfirmation("cancel")).toEqual({
			confirmLabel: "Delete Recording",
			message: "Delete the current recording?",
			detail: "This stops the recording and permanently deletes the captured media.",
		});
	});

	it("does not confirm non-destructive recorder commands", () => {
		expect(getRecorderMenuConfirmation("pause")).toBeNull();
		expect(getRecorderMenuConfirmation("resume")).toBeNull();
		expect(getRecorderMenuConfirmation("stop")).toBeNull();
	});
});

describe("isActiveRecorderUiState", () => {
	it("treats only recording and paused as an active capture session", () => {
		expect(isActiveRecorderUiState("recording")).toBe(true);
		expect(isActiveRecorderUiState("paused")).toBe(true);
		expect(isActiveRecorderUiState("idle")).toBe(false);
		expect(isActiveRecorderUiState("countdown")).toBe(false);
		expect(isActiveRecorderUiState("finalizing")).toBe(false);
	});
});

describe("resolveRecorderUiState", () => {
	it("rejects unknown values at the IPC boundary", () => {
		expect(isRecorderUiState("paused")).toBe(true);
		expect(isRecorderUiState("stopping")).toBe(false);
		expect(isRecorderUiState(null)).toBe(false);
	});

	it("prioritizes finalizing and countdown over transient recording flags", () => {
		expect(
			resolveRecorderUiState({
				recording: false,
				paused: false,
				countdownActive: false,
				finalizing: true,
			}),
		).toBe("finalizing");
		expect(
			resolveRecorderUiState({
				recording: false,
				paused: false,
				countdownActive: true,
				finalizing: false,
			}),
		).toBe("countdown");
	});

	it("distinguishes paused, recording, and idle", () => {
		expect(
			resolveRecorderUiState({
				recording: true,
				paused: true,
				countdownActive: false,
				finalizing: false,
			}),
		).toBe("paused");
		expect(
			resolveRecorderUiState({
				recording: true,
				paused: false,
				countdownActive: false,
				finalizing: false,
			}),
		).toBe("recording");
		expect(
			resolveRecorderUiState({
				recording: false,
				paused: true,
				countdownActive: false,
				finalizing: false,
			}),
		).toBe("idle");
	});
});
