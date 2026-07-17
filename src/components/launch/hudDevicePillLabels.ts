interface DeviceLabelOption {
	deviceId: string;
	label: string;
}

function resolveEnabledDeviceLabel(
	devices: readonly DeviceLabelOption[],
	selectedDeviceId: string | undefined,
	configuredDeviceId: string | undefined,
	genericLabel: string,
) {
	return (
		devices.find((device) => device.deviceId === selectedDeviceId)?.label ||
		devices.find((device) => device.deviceId === configuredDeviceId)?.label ||
		devices[0]?.label ||
		genericLabel
	);
}

export function resolveMicPillLabel(
	devices: readonly DeviceLabelOption[],
	selectedDeviceId: string | undefined,
	microphoneDeviceId: string | undefined,
	enabled: boolean,
	offLabel: string,
	genericLabel = "Microphone",
) {
	if (!enabled) {
		return offLabel;
	}

	return resolveEnabledDeviceLabel(devices, selectedDeviceId, microphoneDeviceId, genericLabel);
}

export function resolveWebcamPillLabel(
	videoDevices: readonly DeviceLabelOption[],
	selectedVideoDeviceId: string | undefined,
	webcamDeviceId: string | undefined,
	enabled: boolean,
	offLabel: string,
	genericLabel = "Camera",
) {
	if (!enabled) {
		return offLabel;
	}

	return resolveEnabledDeviceLabel(
		videoDevices,
		selectedVideoDeviceId,
		webcamDeviceId,
		genericLabel,
	);
}
