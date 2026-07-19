import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createBrowserRecordingOptions,
	createProcessedMicrophoneConstraints,
	discardNativeRecording,
	normalizeBrowserMicrophoneProfile,
	resolveBrowserCaptureCursorPolicy,
	resolveCaptureDeviceId,
	shouldUseNativeMacScreenCaptureForSource,
	shouldUseNativeWindowsCaptureForSource,
	stopMediaRecorderAndWait,
} from "./useScreenRecorder";

type RecordingState = "inactive" | "recording" | "paused";

function createMockMediaRecorder(initialState: RecordingState = "inactive") {
	let _state: RecordingState = initialState;
	return {
		get state() {
			return _state;
		},
		pause: vi.fn(() => {
			if (_state === "recording") _state = "paused";
		}),
		resume: vi.fn(() => {
			if (_state === "paused") _state = "recording";
		}),
		requestData: vi.fn(),
		stop: vi.fn(() => {
			_state = "inactive";
		}),
		start: vi.fn(() => {
			_state = "recording";
		}),
	};
}

describe("stopMediaRecorderAndWait", () => {
	it("does not resolve until the recorder emits stop", async () => {
		const target = new EventTarget();
		let state: RecordingState = "recording";
		const recorder = {
			addEventListener: target.addEventListener.bind(target),
			get state() {
				return state;
			},
			stop: vi.fn(() => {
				state = "inactive";
			}),
		} as unknown as MediaRecorder;
		let resolved = false;
		const stopped = stopMediaRecorderAndWait(recorder).then(() => {
			resolved = true;
		});

		expect(recorder.stop).toHaveBeenCalledOnce();
		await Promise.resolve();
		expect(resolved).toBe(false);

		target.dispatchEvent(new Event("stop"));
		await stopped;
		expect(resolved).toBe(true);
	});
});

describe("discardNativeRecording", () => {
	it("reports deletion failure so restart does not start a replacement", async () => {
		const deleteRecordingFile = vi.fn().mockResolvedValue({ success: false });

		await expect(
			discardNativeRecording(
				() => Promise.resolve({ success: true, path: "/recordings/current.mp4" }),
				deleteRecordingFile,
			),
		).resolves.toBe(false);
		expect(deleteRecordingFile).toHaveBeenCalledWith("/recordings/current.mp4");
	});

	it("does not attempt deletion when native stop did not produce a recording", async () => {
		const deleteRecordingFile = vi.fn();

		await expect(
			discardNativeRecording(
				() => Promise.resolve({ success: false, error: "stop failed" }),
				deleteRecordingFile,
			),
		).resolves.toBe(false);
		expect(deleteRecordingFile).not.toHaveBeenCalled();
	});
});

describe("createProcessedMicrophoneConstraints", () => {
	it("requests browser voice processing with AGC for the default microphone", () => {
		expect(createProcessedMicrophoneConstraints()).toEqual({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				channelCount: { ideal: 1 },
				sampleRate: { ideal: 48000 },
			},
			video: false,
		});
	});

	it("keeps default voice processing when a specific microphone is selected", () => {
		expect(createProcessedMicrophoneConstraints("device-123")).toMatchObject({
			audio: {
				deviceId: { exact: "device-123" },
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				channelCount: { ideal: 1 },
				sampleRate: { ideal: 48000 },
			},
			video: false,
		});
	});

	it("can request the legacy browser processed profile for lab comparisons", () => {
		expect(createProcessedMicrophoneConstraints(undefined, "processed")).toMatchObject({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
			video: false,
		});
	});

	it("can disable AGC for lab comparisons", () => {
		expect(createProcessedMicrophoneConstraints(undefined, "no-agc")).toMatchObject({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: false,
			},
			video: false,
		});
	});

	it("can disable echo cancellation for lab comparisons", () => {
		expect(createProcessedMicrophoneConstraints(undefined, "no-echo")).toMatchObject({
			audio: {
				echoCancellation: false,
				noiseSuppression: true,
				autoGainControl: true,
			},
			video: false,
		});
	});

	it("can request a raw browser microphone stream for lab comparisons", () => {
		expect(createProcessedMicrophoneConstraints(undefined, "raw")).toMatchObject({
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
			},
			video: false,
		});
	});

	it("normalizes invalid lab microphone profiles to production voice processing", () => {
		expect(normalizeBrowserMicrophoneProfile("RAW")).toBe("raw");
		expect(normalizeBrowserMicrophoneProfile("unknown")).toBe("processed");
		expect(normalizeBrowserMicrophoneProfile(null)).toBe("processed");
	});
});

describe("createBrowserRecordingOptions", () => {
	it("sets an aggregate bitrate target for browser screen recordings", () => {
		expect(
			createBrowserRecordingOptions({
				audioBitsPerSecond: 128_000,
				mimeType: "video/webm;codecs=vp9",
				videoBitsPerSecond: 30_600_000,
			}),
		).toEqual({
			audioBitsPerSecond: 128_000,
			bitsPerSecond: 30_728_000,
			mimeType: "video/webm;codecs=vp9",
			videoBitsPerSecond: 30_600_000,
		});
	});

	it("keeps video-only recordings on the requested video budget", () => {
		expect(
			createBrowserRecordingOptions({
				videoBitsPerSecond: 30_600_000,
			}),
		).toEqual({
			bitsPerSecond: 30_600_000,
			videoBitsPerSecond: 30_600_000,
		});
	});
});

describe("resolveBrowserCaptureCursorPolicy", () => {
	it("preserves the existing hidden-cursor browser policy by default", () => {
		expect(resolveBrowserCaptureCursorPolicy()).toEqual({
			streamCursor: "never",
			hideOsCursorBeforeRecording: true,
			hideEditorOverlayCursorByDefault: true,
		});
	});

	it("uses the browser captured cursor after native Windows capture fails to start", () => {
		expect(
			resolveBrowserCaptureCursorPolicy({ nativeWindowsCaptureStartFailed: true }),
		).toEqual({
			streamCursor: "always",
			hideOsCursorBeforeRecording: false,
			hideEditorOverlayCursorByDefault: true,
		});
	});
});

describe("resolveCaptureDeviceId", () => {
	it("uses the explicit device identifier", () => {
		expect(
			resolveCaptureDeviceId({
				id: "device:fallback",
				sourceType: "device",
				deviceId: "camera-1",
			}),
		).toBe("camera-1");
	});

	it("falls back to the device source id suffix", () => {
		expect(resolveCaptureDeviceId({ id: "device:capture-card", sourceType: "device" })).toBe(
			"capture-card",
		);
	});

	it("rejects desktop sources", () => {
		expect(resolveCaptureDeviceId({ id: "screen:1:0", sourceType: "screen" })).toBeNull();
	});
});

describe("shouldUseNativeWindowsCaptureForSource", () => {
	it("keeps native Windows capture on screen sources", () => {
		expect(shouldUseNativeWindowsCaptureForSource({ id: "screen:101:0" })).toBe(true);
	});

	it("keeps native Windows capture on window sources", () => {
		expect(shouldUseNativeWindowsCaptureForSource({ id: "window:123456:0" })).toBe(true);
	});

	it("keeps browser capture for non-desktop sources", () => {
		expect(shouldUseNativeWindowsCaptureForSource({ id: "browser-tab:abc" })).toBe(false);
	});
});

describe("shouldUseNativeMacScreenCaptureForSource", () => {
	it("keeps native mac capture on screen sources", () => {
		expect(shouldUseNativeMacScreenCaptureForSource({ id: "screen:1:0" })).toBe(true);
	});

	it("keeps native mac capture on window sources", () => {
		expect(shouldUseNativeMacScreenCaptureForSource({ id: "window:42:0" })).toBe(true);
	});

	it("uses native mac capture for single-display Area geometry", () => {
		expect(
			shouldUseNativeMacScreenCaptureForSource({
				id: "area:selection",
				sourceType: "area",
				geometry: {
					selection: { x: 0, y: 0, width: 100, height: 100 },
					outputScaleFactor: 2,
					outputSize: { width: 200, height: 200 },
					segments: [
						{
							displayId: "1",
							displayScaleFactor: 2,
							sourceRect: { x: 0, y: 0, width: 100, height: 100 },
							outputRect: { x: 0, y: 0, width: 200, height: 200 },
							captureSize: { width: 200, height: 200 },
						},
					],
				},
			}),
		).toBe(true);
	});

	it("uses native mac capture for multi-display Area geometry", () => {
		expect(
			shouldUseNativeMacScreenCaptureForSource({
				id: "area:multi",
				sourceType: "area",
				geometry: {
					selection: { x: 0, y: 0, width: 400, height: 100 },
					outputScaleFactor: 1,
					outputSize: { width: 400, height: 100 },
					segments: [
						{
							displayId: "1",
							displayScaleFactor: 1,
							sourceRect: { x: 0, y: 0, width: 200, height: 100 },
							outputRect: { x: 0, y: 0, width: 200, height: 100 },
							captureSize: { width: 200, height: 100 },
						},
						{
							displayId: "2",
							displayScaleFactor: 1,
							sourceRect: { x: 0, y: 0, width: 200, height: 100 },
							outputRect: { x: 200, y: 0, width: 200, height: 100 },
							captureSize: { width: 200, height: 100 },
						},
					],
				},
			}),
		).toBe(true);
	});

	it("rejects Area sources without geometry segments", () => {
		expect(
			shouldUseNativeMacScreenCaptureForSource({
				id: "area:empty",
				sourceType: "area",
				geometry: {
					selection: { x: 0, y: 0, width: 10, height: 10 },
					outputScaleFactor: 1,
					outputSize: { width: 10, height: 10 },
					segments: [],
				},
			}),
		).toBe(false);
	});

	it("keeps browser capture for non-desktop sources", () => {
		expect(
			shouldUseNativeMacScreenCaptureForSource({
				id: "device:cam",
				sourceType: "device",
			}),
		).toBe(false);
	});
});

function stopRecording(
	recorder: ReturnType<typeof createMockMediaRecorder>,
	isNativeRecording: boolean,
	webcamRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
) {
	if (isNativeRecording) {
		if (webcamRecorder && webcamRecorder.state !== "inactive") {
			webcamRecorder.stop();
		}
		return { stopped: true, wasNative: true };
	}

	const recorderState = recorder.state;
	if (recorderState === "recording" || recorderState === "paused") {
		if (recorderState === "paused") {
			try {
				recorder.resume();
			} catch {
				// Stopping a paused recorder is still valid; mirror the hook's fallback path.
			}
		}
		if (webcamRecorder && webcamRecorder.state !== "inactive") {
			webcamRecorder.stop();
		}
		try {
			recorder.requestData();
		} catch {
			// Stopping should continue even if the browser refuses an explicit flush.
		}
		recorder.stop();
		return { stopped: true, wasNative: false };
	}
	return { stopped: false, wasNative: false };
}

function pauseRecording(
	recorder: ReturnType<typeof createMockMediaRecorder>,
	recording: boolean,
	paused: boolean,
	isNativeRecording: boolean,
	webcamRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
	micFallbackRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
): boolean {
	if (!recording || paused) return false;
	if (isNativeRecording) {
		if (webcamRecorder?.state === "recording") {
			webcamRecorder.pause();
		}
		if (micFallbackRecorder?.state === "recording") {
			micFallbackRecorder.requestData();
			micFallbackRecorder.pause();
		}
		return true;
	}
	if (recorder.state === "recording") {
		recorder.pause();
		if (webcamRecorder?.state === "recording") {
			webcamRecorder.pause();
		}
		return true;
	}
	return false;
}

function resumeRecording(
	recorder: ReturnType<typeof createMockMediaRecorder>,
	recording: boolean,
	paused: boolean,
	isNativeRecording: boolean,
	webcamRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
	micFallbackRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
): boolean {
	if (!recording || !paused) return false;
	if (isNativeRecording) {
		if (webcamRecorder?.state === "paused") {
			webcamRecorder.resume();
		}
		if (micFallbackRecorder?.state === "paused") {
			micFallbackRecorder.resume();
		}
		return true;
	}
	if (recorder.state === "paused") {
		recorder.resume();
		if (webcamRecorder?.state === "paused") {
			webcamRecorder.resume();
		}
		return true;
	}
	return false;
}

async function pauseNativeRecording(
	webcamRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
	result: { success: boolean } = { success: true },
	micFallbackRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
): Promise<boolean> {
	if (!result.success) {
		return false;
	}

	if (webcamRecorder?.state === "recording") {
		webcamRecorder.pause();
	}
	if (micFallbackRecorder?.state === "recording") {
		micFallbackRecorder.requestData();
		micFallbackRecorder.pause();
	}

	return true;
}

async function resumeNativeRecording(
	webcamRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
	result: { success: boolean } = { success: true },
	micFallbackRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
): Promise<boolean> {
	if (!result.success) {
		return false;
	}

	if (webcamRecorder?.state === "paused") {
		webcamRecorder.resume();
	}
	if (micFallbackRecorder?.state === "paused") {
		micFallbackRecorder.resume();
	}

	return true;
}

async function stopNativeRecordingWithCompanions({
	getRecordingDurationMs,
	markRecordingResumed,
	now,
	stopMicFallbackRecorder,
	stopNativeScreenRecording,
	stopWebcamRecorder,
}: {
	getRecordingDurationMs: (timestampMs: number) => number;
	markRecordingResumed: (timestampMs: number) => void;
	now: () => number;
	stopMicFallbackRecorder: () => Promise<Blob | null>;
	stopNativeScreenRecording: () => Promise<{ success: boolean; path?: string }>;
	stopWebcamRecorder: () => Promise<string | null>;
}) {
	const stoppedAtMs = now();
	markRecordingResumed(stoppedAtMs);
	const expectedDurationMs = getRecordingDurationMs(stoppedAtMs);
	const micFallbackBlobPromise = stopMicFallbackRecorder();
	const webcamPathPromise = stopWebcamRecorder();
	const result = await stopNativeScreenRecording();
	const webcamPath = await webcamPathPromise;
	const micFallbackBlob = await micFallbackBlobPromise;

	return { expectedDurationMs, micFallbackBlob, result, webcamPath };
}

function cancelRecording(
	recorder: ReturnType<typeof createMockMediaRecorder>,
	isNativeRecording: boolean,
	chunks: { current: Blob[] },
	webcamRecorder?: ReturnType<typeof createMockMediaRecorder> | null,
	webcamChunks?: { current: Blob[] },
) {
	if (webcamChunks) webcamChunks.current = [];
	if (webcamRecorder && webcamRecorder.state !== "inactive") {
		webcamRecorder.stop();
	}

	if (isNativeRecording) {
		return { cancelled: true, wasNative: true };
	}

	chunks.current = [];
	if (recorder.state !== "inactive") {
		recorder.stop();
	}
	return { cancelled: true, wasNative: false };
}

describe("useScreenRecorder state machine", () => {
	let recorder: ReturnType<typeof createMockMediaRecorder>;

	beforeEach(() => {
		recorder = createMockMediaRecorder("recording");
	});

	describe("stopRecording", () => {
		it("stops from recording state", () => {
			const result = stopRecording(recorder, false);

			expect(result.stopped).toBe(true);
			expect(recorder.stop).toHaveBeenCalled();
			expect(recorder.resume).not.toHaveBeenCalled();
			expect(recorder.state).toBe("inactive");
		});

		it("resumes then stops from paused state", () => {
			recorder.pause();
			expect(recorder.state).toBe("paused");

			const result = stopRecording(recorder, false);

			expect(result.stopped).toBe(true);
			expect(recorder.resume).toHaveBeenCalled();
			expect(recorder.stop).toHaveBeenCalled();
			expect(recorder.state).toBe("inactive");
		});

		it("resume is called before stop when paused", () => {
			recorder.pause();
			const callOrder: string[] = [];
			recorder.resume.mockImplementation(() => {
				callOrder.push("resume");
			});
			recorder.stop.mockImplementation(() => {
				callOrder.push("stop");
			});

			stopRecording(recorder, false);

			expect(callOrder).toEqual(["resume", "stop"]);
		});

		it("flushes the current recorder data before stopping", () => {
			const callOrder: string[] = [];
			recorder.requestData.mockImplementation(() => {
				callOrder.push("requestData");
			});
			recorder.stop.mockImplementation(() => {
				callOrder.push("stop");
			});

			stopRecording(recorder, false);

			expect(callOrder).toEqual(["requestData", "stop"]);
		});

		it("resumes, flushes, then stops from paused state", () => {
			recorder.pause();
			const callOrder: string[] = [];
			recorder.resume.mockImplementation(() => {
				callOrder.push("resume");
			});
			recorder.requestData.mockImplementation(() => {
				callOrder.push("requestData");
			});
			recorder.stop.mockImplementation(() => {
				callOrder.push("stop");
			});

			stopRecording(recorder, false);

			expect(callOrder).toEqual(["resume", "requestData", "stop"]);
		});

		it("still stops when the explicit data flush fails", () => {
			recorder.requestData.mockImplementation(() => {
				throw new Error("flush failed");
			});

			const result = stopRecording(recorder, false);

			expect(result.stopped).toBe(true);
			expect(recorder.stop).toHaveBeenCalled();
		});

		it("still stops from paused state when the explicit data flush fails", () => {
			recorder.pause();
			const callOrder: string[] = [];
			recorder.resume.mockImplementation(() => {
				callOrder.push("resume");
			});
			recorder.requestData.mockImplementation(() => {
				callOrder.push("requestData");
				throw new Error("flush failed");
			});
			recorder.stop.mockImplementation(() => {
				callOrder.push("stop");
			});

			const result = stopRecording(recorder, false);

			expect(result.stopped).toBe(true);
			expect(callOrder).toEqual(["resume", "requestData", "stop"]);
		});

		it("still stops when resume throws from paused state", () => {
			recorder.pause();
			recorder.resume.mockImplementation(() => {
				throw new Error("resume failed");
			});

			const result = stopRecording(recorder, false);

			expect(result.stopped).toBe(true);
			expect(recorder.stop).toHaveBeenCalled();
			expect(recorder.state).toBe("inactive");
		});

		it("does nothing when already inactive", () => {
			const inactiveRecorder = createMockMediaRecorder("inactive");

			const result = stopRecording(inactiveRecorder, false);

			expect(result.stopped).toBe(false);
			expect(inactiveRecorder.stop).not.toHaveBeenCalled();
		});

		it("delegates to native path for native recordings", () => {
			const result = stopRecording(recorder, true);

			expect(result.stopped).toBe(true);
			expect(result.wasNative).toBe(true);
			expect(recorder.stop).not.toHaveBeenCalled();
		});

		it("stops webcam when stopping browser recording", () => {
			const webcam = createMockMediaRecorder("recording");

			stopRecording(recorder, false, webcam);

			expect(webcam.stop).toHaveBeenCalled();
			expect(webcam.state).toBe("inactive");
		});

		it("stops webcam when stopping native recording", () => {
			const webcam = createMockMediaRecorder("recording");

			stopRecording(recorder, true, webcam);

			expect(webcam.stop).toHaveBeenCalled();
			expect(webcam.state).toBe("inactive");
		});
	});

	describe("pauseRecording", () => {
		it("pauses an active recording", () => {
			const result = pauseRecording(recorder, true, false, false);

			expect(result).toBe(true);
			expect(recorder.pause).toHaveBeenCalled();
			expect(recorder.state).toBe("paused");
		});

		it("does nothing when already paused", () => {
			recorder.pause();
			recorder.pause.mockClear();

			const result = pauseRecording(recorder, true, true, false);

			expect(result).toBe(false);
			expect(recorder.pause).not.toHaveBeenCalled();
		});

		it("does nothing when not recording", () => {
			const result = pauseRecording(recorder, false, false, false);

			expect(result).toBe(false);
			expect(recorder.pause).not.toHaveBeenCalled();
		});

		it("allows pause for native recordings", () => {
			const result = pauseRecording(recorder, true, false, true);

			expect(result).toBe(true);
		});

		it("pauses webcam alongside browser recording", () => {
			const webcam = createMockMediaRecorder("recording");

			pauseRecording(recorder, true, false, false, webcam);

			expect(recorder.state).toBe("paused");
			expect(webcam.state).toBe("paused");
		});

		it("pauses webcam during native recording pause", () => {
			const webcam = createMockMediaRecorder("recording");

			const result = pauseRecording(recorder, true, false, true, webcam);

			expect(result).toBe(true);
			expect(webcam.state).toBe("paused");
		});

		it("pauses browser mic fallback during native recording pause", () => {
			const micFallback = createMockMediaRecorder("recording");

			const result = pauseRecording(recorder, true, false, true, null, micFallback);

			expect(result).toBe(true);
			expect(micFallback.requestData).toHaveBeenCalled();
			expect(micFallback.state).toBe("paused");
		});

		it("skips webcam pause when webcam is not recording", () => {
			const webcam = createMockMediaRecorder("inactive");

			pauseRecording(recorder, true, false, false, webcam);

			expect(webcam.pause).not.toHaveBeenCalled();
		});
	});

	describe("resumeRecording", () => {
		it("resumes a paused recording", () => {
			recorder.pause();

			const result = resumeRecording(recorder, true, true, false);

			expect(result).toBe(true);
			expect(recorder.resume).toHaveBeenCalled();
			expect(recorder.state).toBe("recording");
		});

		it("does nothing when not paused", () => {
			const result = resumeRecording(recorder, true, false, false);

			expect(result).toBe(false);
			expect(recorder.resume).not.toHaveBeenCalled();
		});

		it("does nothing when not recording", () => {
			const result = resumeRecording(recorder, false, true, false);

			expect(result).toBe(false);
		});

		it("resumes webcam alongside browser recording", () => {
			const webcam = createMockMediaRecorder("recording");
			recorder.pause();
			webcam.pause();

			resumeRecording(recorder, true, true, false, webcam);

			expect(recorder.state).toBe("recording");
			expect(webcam.state).toBe("recording");
		});

		it("resumes webcam during native recording resume", () => {
			const webcam = createMockMediaRecorder("recording");
			webcam.pause();

			const result = resumeRecording(recorder, true, true, true, webcam);

			expect(result).toBe(true);
			expect(webcam.state).toBe("recording");
		});

		it("resumes browser mic fallback during native recording resume", () => {
			const micFallback = createMockMediaRecorder("recording");
			micFallback.pause();

			const result = resumeRecording(recorder, true, true, true, null, micFallback);

			expect(result).toBe(true);
			expect(micFallback.state).toBe("recording");
		});

		it("skips webcam resume when webcam is not paused", () => {
			recorder.pause();
			const webcam = createMockMediaRecorder("inactive");

			resumeRecording(recorder, true, true, false, webcam);

			expect(webcam.resume).not.toHaveBeenCalled();
		});
	});

	describe("cancelRecording", () => {
		it("clears chunks and stops browser recording", () => {
			const chunks = { current: [new Blob(["data"])] };

			const result = cancelRecording(recorder, false, chunks);

			expect(result.cancelled).toBe(true);
			expect(result.wasNative).toBe(false);
			expect(chunks.current).toEqual([]);
			expect(recorder.stop).toHaveBeenCalled();
			expect(recorder.state).toBe("inactive");
		});

		it("clears webcam chunks and stops webcam on cancel", () => {
			const chunks = { current: [new Blob(["data"])] };
			const webcamChunks = { current: [new Blob(["cam"])] };
			const webcam = createMockMediaRecorder("recording");

			cancelRecording(recorder, false, chunks, webcam, webcamChunks);

			expect(webcamChunks.current).toEqual([]);
			expect(webcam.stop).toHaveBeenCalled();
			expect(webcam.state).toBe("inactive");
		});

		it("stops webcam when cancelling native recording", () => {
			const chunks = { current: [] as Blob[] };
			const webcam = createMockMediaRecorder("recording");

			const result = cancelRecording(recorder, true, chunks, webcam);

			expect(result.wasNative).toBe(true);
			expect(webcam.stop).toHaveBeenCalled();
			expect(recorder.stop).not.toHaveBeenCalled();
		});

		it("handles cancel when recorder is already inactive", () => {
			const inactiveRecorder = createMockMediaRecorder("inactive");
			const chunks = { current: [new Blob(["data"])] };

			const result = cancelRecording(inactiveRecorder, false, chunks);

			expect(result.cancelled).toBe(true);
			expect(chunks.current).toEqual([]);
			expect(inactiveRecorder.stop).not.toHaveBeenCalled();
		});

		it("handles cancel when webcam is already inactive", () => {
			const chunks = { current: [] as Blob[] };
			const webcam = createMockMediaRecorder("inactive");

			cancelRecording(recorder, false, chunks, webcam);

			expect(webcam.stop).not.toHaveBeenCalled();
		});
	});

	describe("pause → stop → editor flow", () => {
		it("record → pause → stop completes cleanly", () => {
			expect(recorder.state).toBe("recording");

			pauseRecording(recorder, true, false, false);
			expect(recorder.state).toBe("paused");

			const result = stopRecording(recorder, false);
			expect(result.stopped).toBe(true);
			expect(recorder.state).toBe("inactive");
		});

		it("record → pause → resume → stop completes cleanly", () => {
			expect(recorder.state).toBe("recording");

			pauseRecording(recorder, true, false, false);
			expect(recorder.state).toBe("paused");

			resumeRecording(recorder, true, true, false);
			expect(recorder.state).toBe("recording");

			const result = stopRecording(recorder, false);
			expect(result.stopped).toBe(true);
			expect(recorder.state).toBe("inactive");
		});

		it("webcam stays in sync through full pause/resume/stop cycle", () => {
			const webcam = createMockMediaRecorder("recording");

			pauseRecording(recorder, true, false, false, webcam);
			expect(recorder.state).toBe("paused");
			expect(webcam.state).toBe("paused");

			resumeRecording(recorder, true, true, false, webcam);
			expect(recorder.state).toBe("recording");
			expect(webcam.state).toBe("recording");

			stopRecording(recorder, false, webcam);
			expect(recorder.state).toBe("inactive");
			expect(webcam.state).toBe("inactive");
		});

		it("native recording pauses webcam only after native pause succeeds", async () => {
			const webcam = createMockMediaRecorder("recording");
			const micFallback = createMockMediaRecorder("recording");

			const pausedResult = await pauseNativeRecording(webcam, { success: true }, micFallback);
			expect(pausedResult).toBe(true);
			expect(webcam.state).toBe("paused");
			expect(micFallback.requestData).toHaveBeenCalled();
			expect(micFallback.state).toBe("paused");
			expect(recorder.pause).not.toHaveBeenCalled();

			const resumedResult = await resumeNativeRecording(
				webcam,
				{ success: true },
				micFallback,
			);
			expect(resumedResult).toBe(true);
			expect(webcam.state).toBe("recording");
			expect(micFallback.state).toBe("recording");
			expect(recorder.resume).not.toHaveBeenCalled();
		});

		it("native recording leaves webcam state alone when native pause fails", async () => {
			const webcam = createMockMediaRecorder("recording");
			const micFallback = createMockMediaRecorder("recording");

			const pausedResult = await pauseNativeRecording(
				webcam,
				{ success: false },
				micFallback,
			);

			expect(pausedResult).toBe(false);
			expect(webcam.state).toBe("recording");
			expect(webcam.pause).not.toHaveBeenCalled();
			expect(micFallback.state).toBe("recording");
			expect(micFallback.pause).not.toHaveBeenCalled();
		});

		it("stops native capture before awaiting webcam finalization", async () => {
			const callOrder: string[] = [];
			let resolveWebcam: (path: string | null) => void = () => {};
			const webcamPathPromise = new Promise<string | null>((resolve) => {
				resolveWebcam = resolve;
			});
			const stopWebcamRecorder = vi.fn(() => {
				callOrder.push("stop-webcam-started");
				return webcamPathPromise;
			});
			const stopNativeScreenRecording = vi.fn(async () => {
				callOrder.push("stop-native");
				return { success: true, path: "screen.mp4" };
			});
			const markRecordingResumed = vi.fn((timestampMs: number) => {
				callOrder.push(`mark-resumed-${timestampMs}`);
			});
			const getRecordingDurationMs = vi.fn((timestampMs: number) => {
				callOrder.push(`duration-${timestampMs}`);
				return 35000;
			});

			let finalized = false;
			const stopped = stopNativeRecordingWithCompanions({
				getRecordingDurationMs,
				markRecordingResumed,
				now: () => 123456,
				stopMicFallbackRecorder: vi.fn(async () => null),
				stopNativeScreenRecording,
				stopWebcamRecorder,
			}).then((result) => {
				finalized = true;
				return result;
			});

			await Promise.resolve();
			expect(callOrder).toEqual([
				"mark-resumed-123456",
				"duration-123456",
				"stop-webcam-started",
				"stop-native",
			]);
			expect(finalized).toBe(false);

			resolveWebcam("webcam.webm");
			await expect(stopped).resolves.toMatchObject({
				expectedDurationMs: 35000,
				webcamPath: "webcam.webm",
			});
		});

		it("cancel discards both screen and webcam recordings", () => {
			const webcam = createMockMediaRecorder("recording");
			const chunks = { current: [new Blob(["screen"])] };
			const webcamChunks = { current: [new Blob(["cam"])] };

			cancelRecording(recorder, false, chunks, webcam, webcamChunks);

			expect(chunks.current).toEqual([]);
			expect(webcamChunks.current).toEqual([]);
			expect(recorder.state).toBe("inactive");
			expect(webcam.state).toBe("inactive");
		});
	});
});
