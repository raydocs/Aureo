import { describe, expect, it } from "vitest";
import {
	isNativeOpenableLaunchPopoverId,
	NATIVE_OPENABLE_LAUNCH_POPOVER_IDS,
} from "./launchPopoverIds";

describe("launch popover IDs", () => {
	it("limits native menu requests to camera and settings popovers", () => {
		expect(NATIVE_OPENABLE_LAUNCH_POPOVER_IDS).toEqual(["webcam", "more"]);
		expect(isNativeOpenableLaunchPopoverId("webcam")).toBe(true);
		expect(isNativeOpenableLaunchPopoverId("more")).toBe(true);
		expect(isNativeOpenableLaunchPopoverId("sources")).toBe(false);
		expect(isNativeOpenableLaunchPopoverId("unknown")).toBe(false);
	});
});
