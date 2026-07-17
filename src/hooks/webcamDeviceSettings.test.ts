import { describe, expect, it } from "vitest";
import {
	DEFAULT_WEBCAM_DEVICE_SETTINGS,
	normalizeWebcamDeviceSettings,
} from "./webcamDeviceSettings";

describe("normalizeWebcamDeviceSettings", () => {
	it("returns defaults for garbage input", () => {
		expect(normalizeWebcamDeviceSettings(null)).toEqual(DEFAULT_WEBCAM_DEVICE_SETTINGS);
		expect(normalizeWebcamDeviceSettings(undefined)).toEqual(DEFAULT_WEBCAM_DEVICE_SETTINGS);
		expect(normalizeWebcamDeviceSettings("cam")).toEqual(DEFAULT_WEBCAM_DEVICE_SETTINGS);
		expect(normalizeWebcamDeviceSettings(1)).toEqual(DEFAULT_WEBCAM_DEVICE_SETTINGS);
		expect(normalizeWebcamDeviceSettings([])).toEqual(DEFAULT_WEBCAM_DEVICE_SETTINGS);
	});

	it("normalizes deviceId to non-empty string or null", () => {
		expect(normalizeWebcamDeviceSettings({ deviceId: "abc123" }).deviceId).toBe("abc123");
		expect(normalizeWebcamDeviceSettings({ deviceId: "" }).deviceId).toBe(null);
		expect(normalizeWebcamDeviceSettings({ deviceId: 42 }).deviceId).toBe(null);
		expect(normalizeWebcamDeviceSettings({ deviceId: null }).deviceId).toBe(null);
		expect(normalizeWebcamDeviceSettings({}).deviceId).toBe(null);
	});

	it("normalizes enabled to boolean or false", () => {
		expect(normalizeWebcamDeviceSettings({ enabled: true }).enabled).toBe(true);
		expect(normalizeWebcamDeviceSettings({ enabled: false }).enabled).toBe(false);
		expect(normalizeWebcamDeviceSettings({ enabled: "yes" }).enabled).toBe(false);
		expect(normalizeWebcamDeviceSettings({ enabled: 1 }).enabled).toBe(false);
		expect(normalizeWebcamDeviceSettings({}).enabled).toBe(false);
	});

	it("accepts a full valid shape", () => {
		expect(normalizeWebcamDeviceSettings({ deviceId: "device-1", enabled: true })).toEqual({
			deviceId: "device-1",
			enabled: true,
		});
	});
});
