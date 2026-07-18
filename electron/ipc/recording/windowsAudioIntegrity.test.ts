import { describe, expect, it } from "vitest";

import {
	buildWindowsNativeAudioSidecarExpectations,
	collectWindowsAudioIntegrityWarnings,
	EMPTY_WAV_HEADER_BYTES,
	evaluateWindowsAudioSidecarIntegrity,
} from "./windowsAudioIntegrity";

function validRiffWaveHeader(sizeBytes = 100) {
	const header = Buffer.alloc(12);
	header.write("RIFF", 0, "ascii");
	header.writeUInt32LE(Math.max(0, sizeBytes - 8), 4);
	header.write("WAVE", 8, "ascii");
	return header;
}

describe("evaluateWindowsAudioSidecarIntegrity", () => {
	it("treats a missing expected sidecar as a soft warning", () => {
		const result = evaluateWindowsAudioSidecarIntegrity(
			"system",
			"C:\\Aureo\\clip.system.wav",
			{
				exists: false,
			},
		);

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("missing");
		expect(result.warning).toContain("System audio track is missing");
		expect(result.warning).toContain("C:\\Aureo\\clip.system.wav");
	});

	it("treats a 44-byte empty WAV as a soft warning", () => {
		const result = evaluateWindowsAudioSidecarIntegrity("mic", "C:\\Aureo\\clip.mic.wav", {
			exists: true,
			isFile: true,
			sizeBytes: EMPTY_WAV_HEADER_BYTES,
			header: validRiffWaveHeader(EMPTY_WAV_HEADER_BYTES),
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("empty-or-tiny");
		expect(result.warning).toContain("Microphone track is empty or too small");
		expect(result.warning).toContain(`${EMPTY_WAV_HEADER_BYTES} bytes`);
	});

	it("accepts a valid oversized RIFF/WAVE sidecar", () => {
		const sizeBytes = 4800;
		const result = evaluateWindowsAudioSidecarIntegrity(
			"system",
			"C:\\Aureo\\clip.system.wav",
			{
				exists: true,
				isFile: true,
				sizeBytes,
				header: validRiffWaveHeader(sizeBytes),
			},
		);

		expect(result).toEqual({ ok: true, reason: "ok" });
	});

	it("does not warn when the native track was not requested", () => {
		const result = evaluateWindowsAudioSidecarIntegrity("mic", null);

		expect(result).toEqual({ ok: true, reason: "not-requested" });
		expect(result.warning).toBeUndefined();
	});

	it("rejects unreadable headers without hard-failing callers", () => {
		const result = evaluateWindowsAudioSidecarIntegrity(
			"system",
			"C:\\Aureo\\clip.system.wav",
			{
				exists: true,
				isFile: true,
				sizeBytes: 100,
				header: null,
			},
		);

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("unreadable");
	});

	it("rejects non-file paths and invalid WAV headers without hard-failing callers", () => {
		const notFile = evaluateWindowsAudioSidecarIntegrity(
			"system",
			"C:\\Aureo\\clip.system.wav",
			{
				exists: true,
				isFile: false,
				sizeBytes: 100,
			},
		);
		const invalidHeader = evaluateWindowsAudioSidecarIntegrity(
			"system",
			"C:\\Aureo\\clip.system.wav",
			{
				exists: true,
				isFile: true,
				sizeBytes: 100,
				header: Buffer.from("not a wave!!"),
			},
		);

		expect(notFile.ok).toBe(false);
		expect(notFile.reason).toBe("not-file");
		expect(invalidHeader.ok).toBe(false);
		expect(invalidHeader.reason).toBe("invalid-header");
	});
});

describe("buildWindowsNativeAudioSidecarExpectations", () => {
	it("only expects native sidecars that still have paths after fallback resolution", () => {
		expect(buildWindowsNativeAudioSidecarExpectations(null, null)).toEqual([]);
		expect(
			buildWindowsNativeAudioSidecarExpectations("C:\\Aureo\\clip.system.wav", null),
		).toEqual([{ kind: "system", path: "C:\\Aureo\\clip.system.wav" }]);
		// Browser mic fallback clears the native mic path, so it must not be expected.
		expect(
			buildWindowsNativeAudioSidecarExpectations(
				"C:\\Aureo\\clip.system.wav",
				null /* browser mic fallback */,
			),
		).toEqual([{ kind: "system", path: "C:\\Aureo\\clip.system.wav" }]);
	});
});

describe("collectWindowsAudioIntegrityWarnings", () => {
	it("collects only soft warning strings", () => {
		expect(
			collectWindowsAudioIntegrityWarnings([
				{ ok: true, reason: "not-requested" },
				{
					ok: false,
					reason: "missing",
					warning: "System audio track is missing: C:\\Aureo\\clip.system.wav",
				},
				{ ok: true, reason: "ok" },
			]),
		).toEqual(["System audio track is missing: C:\\Aureo\\clip.system.wav"]);
	});
});
