import { loadAppSetting, saveAppSetting } from "@/lib/appSettings";

export interface WebcamDeviceSettings {
	deviceId: string | null;
	enabled: boolean;
}

export const WEBCAM_DEVICE_SETTINGS_STORAGE_KEY = "aureo.recording.webcamDevice";

export const DEFAULT_WEBCAM_DEVICE_SETTINGS: WebcamDeviceSettings = {
	deviceId: null,
	enabled: false,
};

export function normalizeWebcamDeviceSettings(value: unknown): WebcamDeviceSettings {
	const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
	const deviceId =
		typeof raw.deviceId === "string" && raw.deviceId.length > 0 ? raw.deviceId : null;
	const enabled = typeof raw.enabled === "boolean" ? raw.enabled : false;
	return { deviceId, enabled };
}

export function loadWebcamDeviceSettings(): WebcamDeviceSettings {
	return normalizeWebcamDeviceSettings(
		loadAppSetting<unknown>(WEBCAM_DEVICE_SETTINGS_STORAGE_KEY),
	);
}

export function saveWebcamDeviceSettings(value: WebcamDeviceSettings): boolean {
	return saveAppSetting(WEBCAM_DEVICE_SETTINGS_STORAGE_KEY, normalizeWebcamDeviceSettings(value));
}
