import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import { systemPreferences } from "electron";
import { getNativeCaptureHelperBinaryPath, getPrebundledNativeHelperPath } from "../paths/binaries";
import { getRecordingsDir } from "../utils";
import {
	classifyDiskSpace,
	freeBytesFromStatfs,
	type MediaPermissionStatus,
	normalizeMediaAccessStatus,
	portableMediaPermissionFallback,
	type RecordingHealthResult,
	resolveSystemAudioCapability,
} from "./healthCore";
import { isNativeWindowsCaptureAvailable } from "./windows";

export type {
	DiskSpaceStatus,
	MediaPermissionStatus,
	RecordingHealthResult,
	RecordingHealthStatus,
	RecordingHealthStatusError,
	SystemAudioCapability,
	SystemAudioCaptureBackend,
} from "./healthCore";
export {
	classifyDiskSpace,
	freeBytesFromStatfs,
	LOW_DISK_WARNING_BYTES,
	normalizeMediaAccessStatus,
	portableMediaPermissionFallback,
	resolveSystemAudioCapability,
} from "./healthCore";

export async function isNativeMacCaptureHelperPresent(): Promise<boolean> {
	if (process.platform !== "darwin") {
		return false;
	}

	const candidates = [
		getPrebundledNativeHelperPath("aureo-screencapturekit-helper"),
		getNativeCaptureHelperBinaryPath(),
	];

	for (const candidate of candidates) {
		try {
			await fs.access(candidate, fsConstants.X_OK);
			return true;
		} catch {
			// Try the next candidate. Do not compile/request anything here.
		}
	}

	return false;
}

function readMediaAccessStatus(
	mediaType: "screen" | "microphone" | "camera",
	platform: NodeJS.Platform,
): MediaPermissionStatus {
	const querySupported =
		platform === "darwin" ||
		(platform === "win32" && (mediaType === "microphone" || mediaType === "camera"));
	if (!querySupported) {
		return portableMediaPermissionFallback(platform);
	}

	try {
		return normalizeMediaAccessStatus(systemPreferences.getMediaAccessStatus(mediaType));
	} catch {
		return "unknown";
	}
}

async function readStorageFreeBytes(storagePath: string): Promise<number | null> {
	try {
		const stats = await fs.statfs(storagePath);
		return freeBytesFromStatfs(stats);
	} catch {
		return null;
	}
}

/**
 * Read-only recording health snapshot for the launch HUD.
 * Must never request permissions or trigger OS prompts.
 */
export async function getRecordingHealthStatus(
	now: () => Date = () => new Date(),
): Promise<RecordingHealthResult> {
	const platform = process.platform;
	const checkedAt = now().toISOString();

	try {
		const [storagePath, nativeWindowsCaptureAvailable, nativeMacCaptureHelperPresent] =
			await Promise.all([
				getRecordingsDir(),
				isNativeWindowsCaptureAvailable(),
				isNativeMacCaptureHelperPresent(),
			]);

		const freeBytes = await readStorageFreeBytes(storagePath);

		return {
			success: true,
			platform,
			checkedAt,
			permissions: {
				// Read-only: getMediaAccessStatus never prompts.
				screen: readMediaAccessStatus("screen", platform),
				microphone: readMediaAccessStatus("microphone", platform),
				camera: readMediaAccessStatus("camera", platform),
			},
			systemAudio: resolveSystemAudioCapability({
				platform,
				nativeWindowsCaptureAvailable,
				nativeMacCaptureHelperPresent,
			}),
			storage: {
				path: storagePath,
				freeBytes,
				status: classifyDiskSpace(freeBytes),
			},
		};
	} catch (error) {
		return {
			success: false,
			error: String(error),
			platform,
			checkedAt,
		};
	}
}
