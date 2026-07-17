import { describe, expect, it } from "vitest";

import { resolveMicPillLabel, resolveWebcamPillLabel } from "./hudDevicePillLabels";

const devices = [
	{ deviceId: "first", label: "Built-in device" },
	{ deviceId: "selected", label: "Studio device" },
];

describe("resolveMicPillLabel", () => {
	it("uses the selected microphone label while enabled", () => {
		expect(resolveMicPillLabel(devices, "selected", undefined, true, "Mic off")).toBe(
			"Studio device",
		);
	});

	it("falls back to the first microphone label when no id matches", () => {
		expect(resolveMicPillLabel(devices, "missing", "other", true, "Mic off")).toBe(
			"Built-in device",
		);
	});

	it("uses the localized generic microphone label for an empty list", () => {
		expect(resolveMicPillLabel([], undefined, undefined, true, "Mic off", "麦克风")).toBe(
			"麦克风",
		);
	});

	it("uses the off label while disabled", () => {
		expect(resolveMicPillLabel(devices, "selected", undefined, false, "Mic off")).toBe(
			"Mic off",
		);
	});
});

describe("resolveWebcamPillLabel", () => {
	it("uses the selected webcam label while enabled", () => {
		expect(resolveWebcamPillLabel(devices, "selected", undefined, true, "Camera off")).toBe(
			"Studio device",
		);
	});

	it("falls back to the first webcam label when no id matches", () => {
		expect(resolveWebcamPillLabel(devices, "missing", "other", true, "Camera off")).toBe(
			"Built-in device",
		);
	});

	it("uses the localized generic webcam label for an empty list", () => {
		expect(resolveWebcamPillLabel([], undefined, undefined, true, "Camera off", "摄像头")).toBe(
			"摄像头",
		);
	});

	it("uses the off label while disabled", () => {
		expect(resolveWebcamPillLabel(devices, "selected", undefined, false, "Camera off")).toBe(
			"Camera off",
		);
	});
});
