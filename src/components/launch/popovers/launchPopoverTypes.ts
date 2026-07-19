export type { NativeCaptureSourceType as CaptureSourceType } from "@/lib/launchPopoverIds";

import type { NativeCaptureSourceType as CaptureSourceType } from "@/lib/launchPopoverIds";

export interface DesktopSource {
	id: string;
	name: string;
	thumbnail: string | null;
	display_id: string;
	appIcon: string | null;
	sourceType?: CaptureSourceType;
	deviceId?: string;
	geometry?: ProcessedDesktopSource["geometry"];
	appName?: string;
	windowTitle?: string;
}

/**
 * Check if a source is a screen/display
 */
export function isScreenSource(s: DesktopSource): boolean {
	return s.sourceType === "screen" || s.id.startsWith("screen:");
}

/**
 * Check if a source is an application window
 */
export function isWindowSource(s: DesktopSource): boolean {
	return s.sourceType === "window" || s.id.startsWith("window:");
}

export function isAreaSource(s: DesktopSource): boolean {
	return s.sourceType === "area" || s.id.startsWith("area:");
}

export function isDeviceSource(s: DesktopSource): boolean {
	return s.sourceType === "device" || s.id.startsWith("device:");
}

export function mapRawSource(s: DesktopSource): DesktopSource {
	const isWindow = isWindowSource(s);
	const type = s.sourceType ?? (isWindow ? "window" : "screen");
	let displayName = s.name;
	let appName = s.appName;
	if (isWindow && s.windowTitle) {
		displayName = s.windowTitle;
	} else if (isWindow && !appName && s.name.includes(" — ")) {
		const parts = s.name.split(" — ");
		appName = parts[0]?.trim();
		displayName = parts.slice(1).join(" — ").trim() || s.name;
	}
	return {
		id: s.id,
		name: displayName,
		thumbnail: s.thumbnail,
		display_id: s.display_id,
		appIcon: s.appIcon,
		sourceType: type,
		deviceId: s.deviceId,
		geometry: s.geometry,
		appName,
		windowTitle: s.windowTitle ?? displayName,
	};
}

export interface DeviceOption {
	deviceId: string;
	label: string;
}
