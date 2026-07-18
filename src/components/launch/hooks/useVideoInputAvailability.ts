import { useEffect, useState } from "react";

export function countVideoInputDevices(devices: readonly MediaDeviceInfo[]): number {
	return devices.filter((device) => device.kind === "videoinput").length;
}

/** Read-only camera/capture-device availability. This never requests media permission. */
export function useVideoInputAvailability(enabled: boolean): {
	deviceCount: number;
	loading: boolean;
} {
	const [deviceCount, setDeviceCount] = useState(0);
	const [loading, setLoading] = useState(enabled);

	useEffect(() => {
		if (!enabled || !navigator.mediaDevices?.enumerateDevices) {
			setLoading(false);
			return;
		}

		let cancelled = false;
		const refresh = async () => {
			setLoading(true);
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				if (!cancelled) {
					setDeviceCount(countVideoInputDevices(devices));
				}
			} catch (error) {
				if (!cancelled) {
					setDeviceCount(0);
					console.warn("Unable to enumerate video input devices:", error);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void refresh();
		navigator.mediaDevices.addEventListener?.("devicechange", refresh);
		return () => {
			cancelled = true;
			navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
		};
	}, [enabled]);

	return { deviceCount, loading };
}
