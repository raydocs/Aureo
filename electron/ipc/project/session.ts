import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { RECORDING_SESSION_MANIFEST_SUFFIX } from "../constants";
import type {
	RecordingSessionData,
	RecordingSessionManifest,
	RecordingWebcamAppearance,
} from "../types";
import { normalizeVideoSourcePath, parseJsonWithByteOrderMark } from "../utils";

function normalizeRecordingTimeOffsetMs(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeRecordingWebcamAppearance(
	value: unknown,
): RecordingWebcamAppearance | null {
	if (!isPlainObject(value)) {
		return null;
	}

	const result: RecordingWebcamAppearance = {};

	const rawCrop = value.cropRegion;
	if (isPlainObject(rawCrop)) {
		const { x, y, width, height } = rawCrop;
		if (
			typeof x === "number" &&
			Number.isFinite(x) &&
			typeof y === "number" &&
			Number.isFinite(y) &&
			typeof width === "number" &&
			Number.isFinite(width) &&
			typeof height === "number" &&
			Number.isFinite(height)
		) {
			const clampedX = Math.min(1, Math.max(0, x));
			const clampedY = Math.min(1, Math.max(0, y));
			// width/height must end up in (0, 1]
			let clampedWidth = Math.min(1, Math.max(0, width));
			let clampedHeight = Math.min(1, Math.max(0, height));
			clampedWidth = Math.min(clampedWidth, 1 - clampedX);
			clampedHeight = Math.min(clampedHeight, 1 - clampedY);

			if (clampedWidth > 0 && clampedHeight > 0) {
				result.cropRegion = {
					x: clampedX,
					y: clampedY,
					width: clampedWidth,
					height: clampedHeight,
				};
			}
		}
	}

	if (typeof value.mirror === "boolean") {
		result.mirror = value.mirror;
	}

	if (result.cropRegion === undefined && result.mirror === undefined) {
		return null;
	}

	return result;
}

/**
 * Merge rule for set-current-recording-session:
 * - incoming undefined → keep existing (prevents editor time-offset tweaks from clobbering framing)
 * - incoming null → intentional clear
 * - incoming value → normalize and use
 */
export function resolveSessionWebcamAppearanceForUpdate(
	incoming: RecordingWebcamAppearance | null | undefined,
	existing: RecordingWebcamAppearance | null | undefined,
): RecordingWebcamAppearance | null {
	if (incoming === undefined) {
		return existing == null ? null : normalizeRecordingWebcamAppearance(existing);
	}
	if (incoming === null) {
		return null;
	}
	return normalizeRecordingWebcamAppearance(incoming);
}

export function getRecordingSessionManifestPath(videoPath: string) {
	const extension = path.extname(videoPath);
	const baseName = path.basename(videoPath, extension);
	return path.join(path.dirname(videoPath), `${baseName}${RECORDING_SESSION_MANIFEST_SUFFIX}`);
}

function isSafeWebcamFileName(fileName: string): boolean {
	if (!fileName || fileName !== path.basename(fileName)) {
		return false;
	}
	if (fileName.includes("/") || fileName.includes("\\")) {
		return false;
	}
	if (path.isAbsolute(fileName)) {
		return false;
	}
	return true;
}

export async function persistRecordingSessionManifest(
	session: RecordingSessionData,
): Promise<void> {
	const normalizedVideoPath = normalizeVideoSourcePath(session.videoPath);
	if (!normalizedVideoPath) {
		return;
	}

	const normalizedWebcamPath = normalizeVideoSourcePath(session.webcamPath ?? null);
	const manifestPath = getRecordingSessionManifestPath(normalizedVideoPath);

	if (!normalizedWebcamPath) {
		await fs.rm(manifestPath, { force: true });
		return;
	}

	const manifest: RecordingSessionManifest = {
		version: 2,
		videoFileName: path.basename(normalizedVideoPath),
		webcamFileName: path.basename(normalizedWebcamPath),
		timeOffsetMs: normalizeRecordingTimeOffsetMs(session.timeOffsetMs),
	};

	const webcamAppearance = normalizeRecordingWebcamAppearance(session.webcamAppearance);
	if (webcamAppearance) {
		manifest.webcamAppearance = webcamAppearance;
	}

	const tempPath = `${manifestPath}.tmp-${process.pid}`;
	try {
		await fs.writeFile(tempPath, JSON.stringify(manifest, null, 2), "utf-8");
		await fs.rename(tempPath, manifestPath);
	} catch (error) {
		// Best-effort cleanup of the sibling temp file on failure.
		await fs.rm(tempPath, { force: true }).catch(() => {
			/* ignore cleanup errors */
		});
		throw error;
	}
}

export async function resolveRecordingSessionManifest(
	videoPath?: string | null,
): Promise<RecordingSessionData | null> {
	const normalizedVideoPath = normalizeVideoSourcePath(videoPath);
	if (!normalizedVideoPath) {
		return null;
	}

	const manifestPath = getRecordingSessionManifestPath(normalizedVideoPath);

	try {
		const content = await fs.readFile(manifestPath, "utf-8");
		const parsed = parseJsonWithByteOrderMark<Partial<RecordingSessionManifest>>(content);
		if (parsed.version !== 1 && parsed.version !== 2) {
			return null;
		}

		const trimmedWebcamFileName =
			typeof parsed.webcamFileName === "string" && parsed.webcamFileName.trim()
				? parsed.webcamFileName.trim()
				: null;
		const webcamFileName =
			trimmedWebcamFileName && isSafeWebcamFileName(trimmedWebcamFileName)
				? trimmedWebcamFileName
				: null;

		const webcamAppearance = normalizeRecordingWebcamAppearance(parsed.webcamAppearance);

		if (!webcamFileName) {
			return {
				videoPath: normalizedVideoPath,
				webcamPath: null,
				timeOffsetMs: normalizeRecordingTimeOffsetMs(parsed.timeOffsetMs),
				...(webcamAppearance ? { webcamAppearance } : {}),
			};
		}

		const webcamPath = path.join(path.dirname(normalizedVideoPath), webcamFileName);
		const webcamExists = await fs
			.access(webcamPath, fsConstants.F_OK)
			.then(() => true)
			.catch(() => false);

		return {
			videoPath: normalizedVideoPath,
			webcamPath: webcamExists ? webcamPath : null,
			timeOffsetMs: normalizeRecordingTimeOffsetMs(parsed.timeOffsetMs),
			...(webcamAppearance ? { webcamAppearance } : {}),
		};
	} catch {
		return null;
	}
}

export async function resolveLinkedWebcamPath(videoPath?: string | null): Promise<string | null> {
	const normalizedVideoPath = normalizeVideoSourcePath(videoPath);
	if (!normalizedVideoPath) {
		return null;
	}

	const extension = path.extname(normalizedVideoPath);
	const baseName = path.basename(normalizedVideoPath, extension);
	if (!baseName || baseName.endsWith("-webcam")) {
		return null;
	}

	const candidateExtensions = Array.from(
		new Set([extension, ".webm", ".mp4", ".mov", ".mkv", ".avi"].filter(Boolean)),
	);

	for (const candidateExtension of candidateExtensions) {
		const candidatePath = path.join(
			path.dirname(normalizedVideoPath),
			`${baseName}-webcam${candidateExtension}`,
		);

		try {
			await fs.access(candidatePath, fsConstants.F_OK);
			return candidatePath;
		} catch {
			continue;
		}
	}

	return null;
}

export async function resolveRecordingSession(
	videoPath?: string | null,
): Promise<RecordingSessionData | null> {
	const manifestSession = await resolveRecordingSessionManifest(videoPath);
	if (manifestSession) {
		return manifestSession;
	}

	const normalizedVideoPath = normalizeVideoSourcePath(videoPath);
	if (!normalizedVideoPath) {
		return null;
	}

	const linkedWebcamPath = await resolveLinkedWebcamPath(normalizedVideoPath);
	return {
		videoPath: normalizedVideoPath,
		webcamPath: linkedWebcamPath,
	};
}
