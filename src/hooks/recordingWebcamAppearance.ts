import type { WebcamPreviewAppearance } from "@/components/launch/webcamPreviewAppearance";
import { computeWebcamFramingLayout } from "@/components/launch/webcamPreviewFraming";

export interface RecordingWebcamAppearanceSnapshot {
	cropRegion: { x: number; y: number; width: number; height: number };
	mirror: boolean;
}

/**
 * Build the session-bridge webcam appearance snapshot from live preview
 * appearance and the recording track's actual settings.
 */
export function buildRecordingWebcamAppearance(
	appearance: WebcamPreviewAppearance,
	trackSettings: { width?: number; height?: number } | undefined,
): RecordingWebcamAppearanceSnapshot {
	const width = trackSettings?.width;
	const height = trackSettings?.height;
	const videoAspect =
		typeof width === "number" && typeof height === "number" && width > 0 && height > 0
			? width / height
			: 16 / 9;

	const cropRegion = computeWebcamFramingLayout(
		{
			zoom: appearance.zoom,
			fitMode: "fill",
			centerX: appearance.centerX,
			centerY: appearance.centerY,
			mirror: appearance.mirror,
		},
		{ width: appearance.size, height: appearance.size },
		videoAspect,
	).cropRegion;

	return {
		cropRegion,
		mirror: appearance.mirror,
	};
}
