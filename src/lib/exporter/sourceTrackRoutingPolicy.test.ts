import { describe, expect, it } from "vitest";
import { resolveSourceTrackRoutingPolicy } from "./sourceTrackRoutingPolicy";

describe("resolveSourceTrackRoutingPolicy", () => {
	it("prioritizes system+mic sidecars and mutes embedded preview", () => {
		const policy = resolveSourceTrackRoutingPolicy("/tmp/recording.mp4", [
			"/tmp/recording.mp4",
			"/tmp/recording.system.wav",
			"/tmp/recording.mic.wav",
			"/tmp/recording.mixed.wav",
		]);

		expect(policy.playbackPaths).toEqual([
			"/tmp/recording.system.wav",
			"/tmp/recording.mic.wav",
		]);
		expect(policy.muteEmbeddedPreview).toBe(true);
		expect(policy.includeEmbeddedInExport).toBe(false);
	});

	it("falls back to mixed when dedicated tracks are absent", () => {
		const policy = resolveSourceTrackRoutingPolicy("/tmp/recording.mp4", [
			"/tmp/recording.mixed.wav",
		]);

		expect(policy.playbackPaths).toEqual(["/tmp/recording.mixed.wav"]);
		expect(policy.muteEmbeddedPreview).toBe(false);
		expect(policy.includeEmbeddedInExport).toBe(false);
	});

	it("keeps embedded audio when only mic sidecar is present", () => {
		const policy = resolveSourceTrackRoutingPolicy("/tmp/recording.mp4", [
			"/tmp/recording.mp4",
			"/tmp/recording.mic.wav",
		]);

		expect(policy.playbackPaths).toEqual(["/tmp/recording.mic.wav"]);
		expect(policy.muteEmbeddedPreview).toBe(false);
		expect(policy.includeEmbeddedInExport).toBe(true);
	});

	it("drops the inline mic when the caller ships only a cleaned mic sidecar", () => {
		// mac microphone-only capture: the mic is stored inline in the MP4 and the
		// .mic sidecar is its cleaned copy, so the caller omits the video path.
		// Honouring the embedded track too would play the voice twice.
		const policy = resolveSourceTrackRoutingPolicy("/tmp/recording.mp4", [
			"/tmp/recording.mic.m4a",
		]);

		expect(policy.playbackPaths).toEqual(["/tmp/recording.mic.m4a"]);
		expect(policy.muteEmbeddedPreview).toBe(true);
		expect(policy.includeEmbeddedInExport).toBe(false);
	});

	it("keeps embedded audio when no companions were resolved at all", () => {
		const policy = resolveSourceTrackRoutingPolicy("/tmp/plain-video.mp4", []);

		expect(policy.playbackPaths).toEqual([]);
		expect(policy.muteEmbeddedPreview).toBe(false);
		expect(policy.includeEmbeddedInExport).toBe(true);
	});

	it("keeps embedded audio when the caller resolves the video as its own source", () => {
		const policy = resolveSourceTrackRoutingPolicy("/tmp/recording.mp4", [
			"/tmp/recording.mp4",
		]);

		expect(policy.playbackPaths).toEqual([]);
		expect(policy.muteEmbeddedPreview).toBe(false);
		expect(policy.includeEmbeddedInExport).toBe(true);
	});

	it("lets dedicated sidecars supersede a container the caller left out", () => {
		const policy = resolveSourceTrackRoutingPolicy("/tmp/recording.mp4", [
			"/tmp/recording.system.m4a",
			"/tmp/recording.mic.m4a",
		]);

		expect(policy.playbackPaths).toEqual([
			"/tmp/recording.system.m4a",
			"/tmp/recording.mic.m4a",
		]);
		expect(policy.muteEmbeddedPreview).toBe(true);
		expect(policy.includeEmbeddedInExport).toBe(false);
	});
});
