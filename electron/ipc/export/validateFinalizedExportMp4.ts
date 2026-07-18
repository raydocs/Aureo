import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { getFfmpegBinaryPath, getFfprobeBinaryPath } from "../ffmpeg/binary";
import { parseFfmpegDurationSeconds, parseNativeVideoStreamStatsProbeOutput } from "./native-video";

const execFileAsync = promisify(execFile);

export type FinalizedExportMp4Expected = {
	durationSec?: number;
	targetFrames?: number;
};

export type FinalizedExportMp4ProbeSnapshot = {
	isFile: boolean;
	sizeBytes: number;
	canDecodeFrame: boolean;
	durationSec: number | null;
	frameCount: number | null;
};

export type FinalizedExportMp4Validation = {
	fileSizeBytes: number;
	durationSec: number;
	frameCount: number | null;
};

/** Match the static GPU route: 2% of expected duration, clamped to [0.5s, 2s]. */
export function getFinalizedExportDurationToleranceSec(expectedDurationSec: number): number {
	const safeExpected = Math.max(0, expectedDurationSec);
	return Math.min(2, Math.max(0.5, safeExpected * 0.02));
}

function parseDurationFromFfmpegOutput(output: string): number | null {
	const match = output.match(/Duration:\s*([0-9:.]+)/i);
	if (!match) {
		return null;
	}
	const duration = parseFfmpegDurationSeconds(match[1]);
	return duration !== null && duration > 0 ? duration : null;
}

/**
 * Pure issue collector for a finalized streaming export MP4.
 * Callers must not read the whole media file into memory; only probe metadata.
 */
export function collectFinalizedExportMp4Issues(
	probe: FinalizedExportMp4ProbeSnapshot,
	expected?: FinalizedExportMp4Expected,
): string[] {
	const issues: string[] = [];

	if (!probe.isFile) {
		issues.push("output is not a file");
		return issues;
	}

	if (!(probe.sizeBytes > 0)) {
		issues.push("output is empty");
		return issues;
	}

	if (!probe.canDecodeFrame) {
		issues.push("output could not decode at least one video frame");
	}

	if (probe.durationSec === null || !(probe.durationSec > 0)) {
		issues.push("output duration is missing or not positive");
	}

	const expectedDuration =
		typeof expected?.durationSec === "number" &&
		Number.isFinite(expected.durationSec) &&
		expected.durationSec > 0
			? expected.durationSec
			: null;

	const expectedFrames =
		typeof expected?.targetFrames === "number" &&
		Number.isFinite(expected.targetFrames) &&
		expected.targetFrames > 0
			? Math.max(1, Math.round(expected.targetFrames))
			: null;

	if (expectedDuration !== null && probe.durationSec !== null && probe.durationSec > 0) {
		const tolerance = getFinalizedExportDurationToleranceSec(expectedDuration);
		if (Math.abs(probe.durationSec - expectedDuration) > tolerance) {
			issues.push(
				`output duration ${probe.durationSec.toFixed(
					3,
				)}s differs from expected ${expectedDuration.toFixed(3)}s`,
			);
		}
	}

	if (expectedFrames !== null) {
		const minimumFrames = Math.max(1, Math.floor(expectedFrames * 0.95));
		if (probe.frameCount === null) {
			issues.push("missing video frame count");
		} else if (probe.frameCount < minimumFrames) {
			issues.push(`video frames ${probe.frameCount} below expected minimum ${minimumFrames}`);
		}
	} else if (probe.frameCount !== null && probe.frameCount <= 0) {
		issues.push("output frame count is not positive");
	}

	return issues;
}

async function decodeFirstExportVideoFrame(videoPath: string): Promise<{
	ok: boolean;
	stderr: string;
}> {
	const ffmpegPath = getFfmpegBinaryPath();
	try {
		const result = await execFileAsync(
			ffmpegPath,
			["-hide_banner", "-i", videoPath, "-map", "0:v:0", "-frames:v", "1", "-f", "null", "-"],
			{ timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
		);
		return {
			ok: true,
			stderr: typeof result.stderr === "string" ? result.stderr : "",
		};
	} catch (error) {
		const execError = error as NodeJS.ErrnoException & { stderr?: string };
		return {
			ok: false,
			stderr: typeof execError.stderr === "string" ? execError.stderr : "",
		};
	}
}

async function probeExportVideoStreamStats(
	videoPath: string,
	options: { countFrames: boolean },
): Promise<{ durationSec: number | null; frameCount: number | null }> {
	const ffprobePath = getFfprobeBinaryPath();
	const args = [
		"-v",
		"error",
		"-select_streams",
		"v:0",
		...(options.countFrames ? (["-count_frames"] as const) : []),
		"-show_entries",
		"stream=duration,nb_frames,nb_read_frames,avg_frame_rate,r_frame_rate",
		"-of",
		"json",
		videoPath,
	];

	try {
		const result = await execFileAsync(ffprobePath, args, {
			timeout: options.countFrames ? 120_000 : 30_000,
			maxBuffer: 2 * 1024 * 1024,
		});
		const stdout = typeof result.stdout === "string" ? result.stdout : "";
		const stats = parseNativeVideoStreamStatsProbeOutput(stdout);
		if (!stats) {
			return { durationSec: null, frameCount: null };
		}
		return {
			durationSec: stats.durationSec,
			frameCount: stats.frameCount,
		};
	} catch {
		return { durationSec: null, frameCount: null };
	}
}

/**
 * Validate a finalized native/Breeze streaming export MP4 before success is returned.
 * Does not load the media bytes into memory.
 */
export async function validateFinalizedExportMp4(
	videoPath: string,
	expected?: FinalizedExportMp4Expected,
): Promise<FinalizedExportMp4Validation> {
	let isFile = false;
	let sizeBytes = 0;

	try {
		const stat = await fs.stat(videoPath);
		isFile = stat.isFile();
		sizeBytes = stat.size;
	} catch {
		isFile = false;
		sizeBytes = 0;
	}

	// Fail fast on missing/empty outputs so we never register an owned path and
	// avoid probing non-media bytes through ffmpeg/ffprobe.
	const earlyIssues = collectFinalizedExportMp4Issues(
		{
			isFile,
			sizeBytes,
			canDecodeFrame: true,
			durationSec: 1,
			frameCount: null,
		},
		undefined,
	).filter((issue) => issue === "output is not a file" || issue === "output is empty");
	if (earlyIssues.length > 0) {
		throw new Error(`Finalized export MP4 is invalid: ${earlyIssues.join("; ")}`);
	}

	const needsFrameCount =
		typeof expected?.targetFrames === "number" &&
		Number.isFinite(expected.targetFrames) &&
		expected.targetFrames > 0;

	const decode = await decodeFirstExportVideoFrame(videoPath);
	const streamStats = await probeExportVideoStreamStats(videoPath, {
		countFrames: needsFrameCount,
	});

	const durationSec = streamStats.durationSec ?? parseDurationFromFfmpegOutput(decode.stderr);

	const probe: FinalizedExportMp4ProbeSnapshot = {
		isFile,
		sizeBytes,
		canDecodeFrame: decode.ok,
		durationSec,
		frameCount: streamStats.frameCount,
	};

	const issues = collectFinalizedExportMp4Issues(probe, expected);
	if (issues.length > 0) {
		throw new Error(`Finalized export MP4 is invalid: ${issues.join("; ")}`);
	}

	return {
		fileSizeBytes: sizeBytes,
		durationSec: durationSec as number,
		frameCount: streamStats.frameCount,
	};
}
