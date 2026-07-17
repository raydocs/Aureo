import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		getPath: (name: string) => {
			if (name === "userData" || name === "appData" || name === "temp") {
				return path.join(os.tmpdir(), "aureo-session-test-app");
			}
			return os.tmpdir();
		},
		setPath: () => undefined,
	},
}));

import {
	getRecordingSessionManifestPath,
	normalizeRecordingWebcamAppearance,
	persistRecordingSessionManifest,
	resolveRecordingSessionManifest,
	resolveSessionWebcamAppearanceForUpdate,
} from "./session";

describe("recording session webcam appearance", () => {
	let tempDir: string;
	let videoPath: string;
	let webcamPath: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aureo-session-"));
		videoPath = path.join(tempDir, "rec.webm");
		webcamPath = path.join(tempDir, "rec-webcam.webm");
		await fs.writeFile(videoPath, "video");
		await fs.writeFile(webcamPath, "webcam");
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("persist→resolve round-trip keeps webcamAppearance exactly", async () => {
		const webcamAppearance = {
			cropRegion: { x: 0.2, y: 0, width: 0.5625, height: 1 },
			mirror: true,
		};

		await persistRecordingSessionManifest({
			videoPath,
			webcamPath,
			timeOffsetMs: 120,
			webcamAppearance,
		});

		const resolved = await resolveRecordingSessionManifest(videoPath);
		expect(resolved).toMatchObject({
			videoPath,
			webcamPath,
			timeOffsetMs: 120,
			webcamAppearance,
		});
	});

	it("resolves old-build manifests that lack webcamAppearance", async () => {
		const manifestPath = getRecordingSessionManifestPath(videoPath);
		await fs.writeFile(
			manifestPath,
			JSON.stringify(
				{
					version: 2,
					videoFileName: "rec.webm",
					webcamFileName: "rec-webcam.webm",
					timeOffsetMs: 45,
				},
				null,
				2,
			),
			"utf-8",
		);

		const resolved = await resolveRecordingSessionManifest(videoPath);
		expect(resolved).toEqual({
			videoPath,
			webcamPath,
			timeOffsetMs: 45,
		});
		expect(resolved).not.toHaveProperty("webcamAppearance");
	});

	describe("resolveSessionWebcamAppearanceForUpdate", () => {
		const existing = {
			cropRegion: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
			mirror: false,
		};

		it("undefined incoming preserves existing", () => {
			expect(resolveSessionWebcamAppearanceForUpdate(undefined, existing)).toEqual(existing);
			expect(resolveSessionWebcamAppearanceForUpdate(undefined, null)).toBeNull();
			expect(resolveSessionWebcamAppearanceForUpdate(undefined, undefined)).toBeNull();
		});

		it("null incoming clears appearance", () => {
			expect(resolveSessionWebcamAppearanceForUpdate(null, existing)).toBeNull();
		});

		it("provided incoming is normalized", () => {
			expect(
				resolveSessionWebcamAppearanceForUpdate(
					{ cropRegion: { x: -0.5, y: 0, width: 2, height: 1 }, mirror: true },
					existing,
				),
			).toEqual({
				cropRegion: { x: 0, y: 0, width: 1, height: 1 },
				mirror: true,
			});
		});
	});

	it("integration: omitted webcamAppearance on update does not clobber framing", async () => {
		const webcamAppearance = {
			cropRegion: { x: 0.2, y: 0, width: 0.5625, height: 1 },
			mirror: true,
		};

		await persistRecordingSessionManifest({
			videoPath,
			webcamPath,
			timeOffsetMs: 0,
			webcamAppearance,
		});

		const resolved = await resolveRecordingSessionManifest(videoPath);
		expect(resolved?.webcamAppearance).toEqual(webcamAppearance);

		// Stale caller (e.g. editor time-offset tweak) omits the field entirely.
		const staleUpdate = {
			videoPath: resolved!.videoPath,
			webcamPath: resolved!.webcamPath,
			timeOffsetMs: 250,
			// no webcamAppearance
		};
		const mergedAppearance = resolveSessionWebcamAppearanceForUpdate(
			staleUpdate.webcamAppearance as undefined,
			resolved?.webcamAppearance,
		);

		await persistRecordingSessionManifest({
			...staleUpdate,
			webcamAppearance: mergedAppearance,
		});

		const afterClobberPath = await resolveRecordingSessionManifest(videoPath);
		expect(afterClobberPath).toMatchObject({
			timeOffsetMs: 250,
			webcamAppearance,
		});
	});

	describe("normalizeRecordingWebcamAppearance", () => {
		it("returns null for garbage shapes and empty objects", () => {
			expect(normalizeRecordingWebcamAppearance(null)).toBeNull();
			expect(normalizeRecordingWebcamAppearance(undefined)).toBeNull();
			expect(normalizeRecordingWebcamAppearance("mirror")).toBeNull();
			expect(normalizeRecordingWebcamAppearance(42)).toBeNull();
			expect(normalizeRecordingWebcamAppearance([])).toBeNull();
			expect(normalizeRecordingWebcamAppearance({})).toBeNull();
			expect(normalizeRecordingWebcamAppearance({ cropRegion: { x: 0 } })).toBeNull();
			expect(
				normalizeRecordingWebcamAppearance({
					cropRegion: { x: "0", y: 0, width: 1, height: 1 },
				}),
			).toBeNull();
			expect(normalizeRecordingWebcamAppearance({ mirror: "true" })).toBeNull();
		});

		it("clamps out-of-range values and x+width>1", () => {
			expect(
				normalizeRecordingWebcamAppearance({
					cropRegion: { x: -1, y: 2, width: 3, height: -0.5 },
				}),
			).toBeNull(); // height clamps to 0 → omitted; no mirror → null

			expect(
				normalizeRecordingWebcamAppearance({
					cropRegion: { x: 0.5, y: 0.25, width: 0.8, height: 0.9 },
					mirror: false,
				}),
			).toEqual({
				cropRegion: { x: 0.5, y: 0.25, width: 0.5, height: 0.75 },
				mirror: false,
			});
		});

		it("keeps full-frame cropRegion {0,0,1,1}", () => {
			expect(
				normalizeRecordingWebcamAppearance({
					cropRegion: { x: 0, y: 0, width: 1, height: 1 },
				}),
			).toEqual({
				cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			});
		});

		it("drops non-boolean mirror and accepts mirror-only objects", () => {
			expect(
				normalizeRecordingWebcamAppearance({
					cropRegion: { x: 0, y: 0, width: 0.5, height: 0.5 },
					mirror: 1,
				}),
			).toEqual({
				cropRegion: { x: 0, y: 0, width: 0.5, height: 0.5 },
			});

			expect(normalizeRecordingWebcamAppearance({ mirror: true })).toEqual({
				mirror: true,
			});
		});
	});

	it("hardens webcamFileName against path traversal and absolute paths", async () => {
		const manifestPath = getRecordingSessionManifestPath(videoPath);

		for (const evilName of ["../evil.webm", "/abs/path.webm", "a/b.webm"]) {
			await fs.writeFile(
				manifestPath,
				JSON.stringify({
					version: 2,
					videoFileName: "rec.webm",
					webcamFileName: evilName,
					timeOffsetMs: 0,
				}),
				"utf-8",
			);

			const resolved = await resolveRecordingSessionManifest(videoPath);
			expect(resolved?.webcamPath).toBeNull();
		}

		await fs.writeFile(
			manifestPath,
			JSON.stringify({
				version: 2,
				videoFileName: "rec.webm",
				webcamFileName: "rec-webcam.webm",
				timeOffsetMs: 10,
			}),
			"utf-8",
		);

		const safe = await resolveRecordingSessionManifest(videoPath);
		expect(safe?.webcamPath).toBe(webcamPath);
	});

	it("returns null for corrupted truncated JSON manifests", async () => {
		const manifestPath = getRecordingSessionManifestPath(videoPath);
		await fs.writeFile(manifestPath, '{"version":2,"videoFileName":"rec.webm"', "utf-8");

		await expect(resolveRecordingSessionManifest(videoPath)).resolves.toBeNull();
	});

	it("writes manifests atomically without leaving tmp siblings", async () => {
		await persistRecordingSessionManifest({
			videoPath,
			webcamPath,
			timeOffsetMs: 0,
			webcamAppearance: { mirror: true },
		});

		const entries = await fs.readdir(tempDir);
		expect(entries.filter((entry) => entry.includes(".tmp"))).toEqual([]);

		const manifestPath = getRecordingSessionManifestPath(videoPath);
		const content = await fs.readFile(manifestPath, "utf-8");
		const parsed = JSON.parse(content);
		expect(parsed).toMatchObject({
			version: 2,
			videoFileName: "rec.webm",
			webcamFileName: "rec-webcam.webm",
			webcamAppearance: { mirror: true },
		});
	});
});
