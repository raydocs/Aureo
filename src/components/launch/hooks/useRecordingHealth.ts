import { useCallback, useEffect, useState } from "react";

type RecordingHealthResult = Awaited<ReturnType<Window["electronAPI"]["getRecordingHealthStatus"]>>;

export type RecordingHealthSnapshot = Extract<RecordingHealthResult, { success: true }>;

const HEALTH_POLL_INTERVAL_MS = 5000;

export function formatAvailableStorage(freeBytes: number | null): string {
	if (freeBytes === null || !Number.isFinite(freeBytes) || freeBytes < 0) {
		return "Unknown";
	}

	const gibibytes = freeBytes / 1024 ** 3;
	if (gibibytes >= 10) {
		return `${Math.round(gibibytes)} GB free`;
	}

	return `${gibibytes.toFixed(1)} GB free`;
}

export function useRecordingHealth(enabled: boolean): {
	health: RecordingHealthSnapshot | null;
	loading: boolean;
	refresh: () => Promise<void>;
} {
	const [health, setHealth] = useState<RecordingHealthSnapshot | null>(null);
	const [loading, setLoading] = useState(enabled);

	const refresh = useCallback(async () => {
		if (!enabled || !window.electronAPI?.getRecordingHealthStatus) {
			return;
		}

		setLoading(true);
		try {
			const result = await window.electronAPI.getRecordingHealthStatus();
			if (result.success) {
				setHealth(result);
			}
		} catch (error) {
			console.warn("Unable to refresh recording health status:", error);
		} finally {
			setLoading(false);
		}
	}, [enabled]);

	useEffect(() => {
		if (!enabled) {
			setLoading(false);
			return;
		}

		void refresh();
		const intervalId = window.setInterval(() => {
			if (document.visibilityState === "visible") {
				void refresh();
			}
		}, HEALTH_POLL_INTERVAL_MS);
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void refresh();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [enabled, refresh]);

	return { health, loading, refresh };
}
