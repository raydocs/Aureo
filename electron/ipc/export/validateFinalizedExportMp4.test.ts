import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		getAppPath: vi.fn(() => process.cwd()),
		getPath: vi.fn(() => process.env.TEMP ?? process.cwd()),
		isPackaged: false,
	},
}));

const binaryMocks = vi.hoisted(() => ({
	getFfmpegBinaryPath: vi.fn(() => "ffmpeg"),
	getFfprobeBinaryPath: vi.fn(() => "ffprobe"),
}));

vi.mock("../ffmpeg/binary", () => ({
	getFfmpegBinaryPath: binaryMocks.getFfmpegBinaryPath,
	getFfprobeBinaryPath: binaryMocks.getFfprobeBinaryPath,
}));

vi.mock("../state", () => ({
	cachedNativeVideoEncoder: null,
	setCachedNativeVideoEncoder: vi.fn(),
}));

const fsMocks = vi.hoisted(() => ({
	stat: vi.fn(),
	access: vi.fn(),
	writeFile: vi.fn(),
	readFile: vi.fn(),
	unlink: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	default: fsMocks,
	...fsMocks,
}));

const execFileMock = vi.hoisted(() =>
	vi.fn(
		(
			_cmd: string,
			_args: string[],
			_opts: unknown,
			cb: (err: Error | null, res?: { stdout: string; stderr: string }) => void,
		) => {
			cb(null, { stdout: "", stderr: "" });
			return {} as unknown;
		},
	),
);

vi.mock("node:child_process", () => ({
	execFile: execFileMock,
	spawn: vi.fn(),
}));

import {
	collectFinalizedExportMp4Issues,
	type FinalizedExportMp4ProbeSnapshot,
	getFinalizedExportDurationToleranceSec,
	validateFinalizedExportMp4,
} from "./validateFinalizedExportMp4";

function baseProbe(
	overrides: Partial<FinalizedExportMp4ProbeSnapshot> = {},
): FinalizedExportMp4ProbeSnapshot {
	return {
		isFile: true,
		sizeBytes: 128_000,
		canDecodeFrame: true,
		durationSec: 10,
		frameCount: 300,
		...overrides,
	};
}

describe("getFinalizedExportDurationToleranceSec", () => {
	it("clamps short exports to 0.5s and long exports to 2s", () => {
		expect(getFinalizedExportDurationToleranceSec(1)).toBe(0.5);
		expect(getFinalizedExportDurationToleranceSec(10)).toBe(0.5);
		expect(getFinalizedExportDurationToleranceSec(100)).toBe(2);
	});
});

describe("collectFinalizedExportMp4Issues", () => {
	it("accepts a valid finalized MP4 with no expected metadata", () => {
		expect(collectFinalizedExportMp4Issues(baseProbe())).toEqual([]);
	});

	it("accepts a valid finalized MP4 when duration and frame count match expectations", () => {
		expect(
			collectFinalizedExportMp4Issues(baseProbe(), {
				durationSec: 10,
				targetFrames: 300,
			}),
		).toEqual([]);
	});

	it("rejects non-file outputs", () => {
		expect(collectFinalizedExportMp4Issues(baseProbe({ isFile: false }))).toEqual([
			"output is not a file",
		]);
	});

	it("rejects empty outputs", () => {
		expect(collectFinalizedExportMp4Issues(baseProbe({ sizeBytes: 0 }))).toEqual([
			"output is empty",
		]);
	});

	it("rejects outputs that cannot decode a frame", () => {
		expect(
			collectFinalizedExportMp4Issues(
				baseProbe({
					canDecodeFrame: false,
				}),
			),
		).toEqual(["output could not decode at least one video frame"]);
	});

	it("rejects missing or zero duration", () => {
		expect(collectFinalizedExportMp4Issues(baseProbe({ durationSec: null }))).toEqual([
			"output duration is missing or not positive",
		]);
		expect(collectFinalizedExportMp4Issues(baseProbe({ durationSec: 0 }))).toEqual([
			"output duration is missing or not positive",
		]);
	});

	it("rejects zero frame count when reported without expectations", () => {
		expect(collectFinalizedExportMp4Issues(baseProbe({ frameCount: 0 }))).toEqual([
			"output frame count is not positive",
		]);
	});

	it("rejects clearly truncated duration relative to expected duration", () => {
		expect(
			collectFinalizedExportMp4Issues(
				baseProbe({
					durationSec: 0.067,
					frameCount: 2,
				}),
				{ durationSec: 45, targetFrames: 1350 },
			),
		).toEqual([
			"output duration 0.067s differs from expected 45.000s",
			"video frames 2 below expected minimum 1282",
		]);
	});

	it("rejects missing frame count when expected frames are provided", () => {
		expect(
			collectFinalizedExportMp4Issues(baseProbe({ frameCount: null }), {
				durationSec: 10,
				targetFrames: 300,
			}),
		).toEqual(["missing video frame count"]);
	});

	it("reports decode and duration failures together when both are broken", () => {
		expect(
			collectFinalizedExportMp4Issues(
				baseProbe({
					canDecodeFrame: false,
					durationSec: null,
					frameCount: null,
				}),
			),
		).toEqual([
			"output could not decode at least one video frame",
			"output duration is missing or not positive",
		]);
	});

	it("allows small duration drift inside the static-route tolerance", () => {
		expect(
			collectFinalizedExportMp4Issues(
				baseProbe({
					durationSec: 10.4,
					frameCount: 300,
				}),
				{ durationSec: 10, targetFrames: 300 },
			),
		).toEqual([]);
	});
});

describe("validateFinalizedExportMp4", () => {
	beforeEach(() => {
		execFileMock.mockReset();
		fsMocks.stat.mockReset();
		binaryMocks.getFfmpegBinaryPath.mockClear();
		binaryMocks.getFfprobeBinaryPath.mockClear();
	});

	it("accepts a non-empty MP4 that decodes one frame with positive duration", async () => {
		fsMocks.stat.mockResolvedValue({ isFile: () => true, size: 50_000 });
		execFileMock.mockImplementation(
			(
				cmd: string,
				_args: string[],
				_opts: unknown,
				cb: (err: Error | null, res?: { stdout: string; stderr: string }) => void,
			) => {
				if (cmd === "ffmpeg") {
					cb(null, {
						stdout: "",
						stderr: "Duration: 00:00:10.00, start: 0.000000, bitrate: 1000 kb/s\nStream #0:0: Video: h264",
					});
					return {} as unknown;
				}
				cb(null, {
					stdout: JSON.stringify({
						streams: [
							{
								duration: "10.000000",
								nb_frames: "300",
								avg_frame_rate: "30/1",
							},
						],
					}),
					stderr: "",
				});
				return {} as unknown;
			},
		);

		await expect(validateFinalizedExportMp4("/tmp/export.mp4")).resolves.toMatchObject({
			fileSizeBytes: 50_000,
			durationSec: 10,
			frameCount: 300,
		});
	});

	it("rejects empty files before probing", async () => {
		fsMocks.stat.mockResolvedValue({ isFile: () => true, size: 0 });

		await expect(validateFinalizedExportMp4("/tmp/empty.mp4")).rejects.toThrow(
			"output is empty",
		);
		expect(execFileMock).not.toHaveBeenCalled();
	});

	it("rejects outputs that fail frame decode / probe", async () => {
		fsMocks.stat.mockResolvedValue({ isFile: () => true, size: 4096 });
		execFileMock.mockImplementation(
			(
				_cmd: string,
				_args: string[],
				_opts: unknown,
				cb: (err: Error | null, res?: { stdout: string; stderr: string }) => void,
			) => {
				const error = Object.assign(new Error("decode failed"), {
					stderr: "Invalid data found when processing input",
				});
				cb(error);
				return {} as unknown;
			},
		);

		await expect(validateFinalizedExportMp4("/tmp/broken.mp4")).rejects.toThrow(
			"Finalized export MP4 is invalid",
		);
	});

	it("rejects clearly truncated exports when expected duration is provided", async () => {
		fsMocks.stat.mockResolvedValue({ isFile: () => true, size: 2048 });
		execFileMock.mockImplementation(
			(
				cmd: string,
				_args: string[],
				_opts: unknown,
				cb: (err: Error | null, res?: { stdout: string; stderr: string }) => void,
			) => {
				if (cmd === "ffmpeg") {
					cb(null, {
						stdout: "",
						stderr: "Duration: 00:00:00.07, start: 0.000000, bitrate: 100 kb/s\nStream #0:0: Video: h264",
					});
					return {} as unknown;
				}
				cb(null, {
					stdout: JSON.stringify({
						streams: [
							{
								duration: "0.067000",
								nb_frames: "2",
								avg_frame_rate: "30/1",
							},
						],
					}),
					stderr: "",
				});
				return {} as unknown;
			},
		);

		await expect(
			validateFinalizedExportMp4("/tmp/truncated.mp4", {
				durationSec: 45,
				targetFrames: 1350,
			}),
		).rejects.toThrow(/differs from expected 45\.000s|below expected minimum/);
	});
});
