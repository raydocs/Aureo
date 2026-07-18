import { describe, expect, it } from "vitest";
import { countVideoInputDevices } from "./useVideoInputAvailability";

function mediaDevice(kind: MediaDeviceKind): MediaDeviceInfo {
	return { deviceId: kind, groupId: "group", kind, label: kind, toJSON: () => ({}) };
}

describe("countVideoInputDevices", () => {
	it("counts only camera and capture-card video inputs", () => {
		expect(
			countVideoInputDevices([
				mediaDevice("audioinput"),
				mediaDevice("videoinput"),
				mediaDevice("audiooutput"),
				mediaDevice("videoinput"),
			]),
		).toBe(2);
	});
});
