/** Stable media permission statuses exposed to the renderer. */
export type MediaPermissionStatus =
	| "granted"
	| "denied"
	| "not-determined"
	| "restricted"
	| "unknown";

export type SystemAudioCaptureBackend = "mac-screencapturekit" | "windows-wgc" | "browser" | "none";

export type DiskSpaceStatus = "ok" | "low" | "unknown";

/** Warn when free space drops below 2 GiB. */
export const LOW_DISK_WARNING_BYTES = 2 * 1024 * 1024 * 1024;

export type RecordingHealthStatus = {
	success: true;
	platform: NodeJS.Platform;
	checkedAt: string;
	permissions: {
		screen: MediaPermissionStatus;
		microphone: MediaPermissionStatus;
		camera: MediaPermissionStatus;
	};
	/**
	 * System-audio is a backend capability, not an OS permission.
	 * `supported` means the product has a capture path for this platform;
	 * `available` means that path is currently usable.
	 */
	systemAudio: {
		supported: boolean;
		available: boolean;
		backend: SystemAudioCaptureBackend;
	};
	storage: {
		path: string;
		freeBytes: number | null;
		status: DiskSpaceStatus;
	};
};

export type RecordingHealthStatusError = {
	success: false;
	error: string;
	platform: NodeJS.Platform;
	checkedAt: string;
};

export type RecordingHealthResult = RecordingHealthStatus | RecordingHealthStatusError;

const KNOWN_MEDIA_STATUSES = new Set<MediaPermissionStatus>([
	"granted",
	"denied",
	"not-determined",
	"restricted",
	"unknown",
]);

/**
 * Normalize Electron / OS media-access strings into a closed union.
 * Never invents grant state for unknown values.
 */
export function normalizeMediaAccessStatus(status: unknown): MediaPermissionStatus {
	if (typeof status !== "string") {
		return "unknown";
	}

	const normalized = status.trim().toLowerCase();
	if (KNOWN_MEDIA_STATUSES.has(normalized as MediaPermissionStatus)) {
		return normalized as MediaPermissionStatus;
	}

	return "unknown";
}

/** Portable fallback when Electron cannot query a permission without prompting. */
export function portableMediaPermissionFallback(_platform: NodeJS.Platform): MediaPermissionStatus {
	return "unknown";
}

export function freeBytesFromStatfs(stats: {
	bavail: number | bigint;
	bsize: number | bigint;
}): number | null {
	const availableBlocks = Number(stats.bavail);
	const blockSize = Number(stats.bsize);
	if (
		!Number.isFinite(availableBlocks) ||
		!Number.isFinite(blockSize) ||
		availableBlocks < 0 ||
		blockSize <= 0
	) {
		return null;
	}

	const freeBytes = availableBlocks * blockSize;
	return Number.isFinite(freeBytes) ? freeBytes : null;
}

export function classifyDiskSpace(
	freeBytes: number | null,
	lowThresholdBytes = LOW_DISK_WARNING_BYTES,
): DiskSpaceStatus {
	if (freeBytes === null || !Number.isFinite(freeBytes) || freeBytes < 0) {
		return "unknown";
	}

	return freeBytes < lowThresholdBytes ? "low" : "ok";
}

export type SystemAudioCapability = {
	supported: boolean;
	available: boolean;
	backend: SystemAudioCaptureBackend;
};

/**
 * Resolve system-audio capture support from platform/backend capability only.
 * Does not map to a fake "permission" status.
 */
export function resolveSystemAudioCapability(input: {
	platform: NodeJS.Platform;
	nativeWindowsCaptureAvailable: boolean;
	nativeMacCaptureHelperPresent: boolean;
}): SystemAudioCapability {
	const { platform, nativeWindowsCaptureAvailable, nativeMacCaptureHelperPresent } = input;

	if (platform === "darwin") {
		// ScreenCaptureKit is the supported system-audio path on macOS.
		// Helper presence is the runtime availability signal (no separate OS permission).
		return {
			supported: true,
			available: nativeMacCaptureHelperPresent,
			backend: nativeMacCaptureHelperPresent ? "mac-screencapturekit" : "none",
		};
	}

	if (platform === "win32") {
		if (nativeWindowsCaptureAvailable) {
			return {
				supported: true,
				available: true,
				backend: "windows-wgc",
			};
		}

		// Browser getDisplayMedia can still request loopback audio without WGC.
		return {
			supported: true,
			available: true,
			backend: "browser",
		};
	}

	// Linux / other: browser/portal best-effort; no OS system-audio permission exists.
	return {
		supported: true,
		available: true,
		backend: "browser",
	};
}
