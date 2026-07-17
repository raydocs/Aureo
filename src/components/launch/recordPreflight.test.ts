import { describe, expect, it } from "vitest";

import { shouldConfirmMutedCameraRecording } from "./recordPreflight";

describe("shouldConfirmMutedCameraRecording", () => {
	it.each([
		{ webcamEnabled: false, microphoneEnabled: false, expected: false },
		{ webcamEnabled: false, microphoneEnabled: true, expected: false },
		{ webcamEnabled: true, microphoneEnabled: false, expected: true },
		{ webcamEnabled: true, microphoneEnabled: true, expected: false },
	])("returns $expected when webcamEnabled=$webcamEnabled and microphoneEnabled=$microphoneEnabled", ({
		webcamEnabled,
		microphoneEnabled,
		expected,
	}) => {
		expect(shouldConfirmMutedCameraRecording({ webcamEnabled, microphoneEnabled })).toBe(
			expected,
		);
	});
});
