import { describe, expect, it } from "vitest";
import { isNativeOpenableLaunchPopoverId, NATIVE_CAPTURE_SOURCE_TYPES } from "./launchPopoverIds";

describe("launch popover IDs", () => {
	it("limits native menu requests to camera and settings popovers", () => {
		expect(isNativeOpenableLaunchPopoverId("webcam")).toBe(true);
		expect(isNativeOpenableLaunchPopoverId("more")).toBe(true);
		expect(isNativeOpenableLaunchPopoverId("sources")).toBe(false);
		expect(isNativeOpenableLaunchPopoverId("unknown")).toBe(false);
	});

	it("defines the native New Recording source order", () => {
		expect(NATIVE_CAPTURE_SOURCE_TYPES).toEqual(["screen", "window", "area", "device"]);
	});
});
