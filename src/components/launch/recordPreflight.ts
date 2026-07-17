export function shouldConfirmMutedCameraRecording({
	webcamEnabled,
	microphoneEnabled,
}: {
	webcamEnabled: boolean;
	microphoneEnabled: boolean;
}): boolean {
	return webcamEnabled && !microphoneEnabled;
}
