import { describe, expect, it } from "vitest";
import { getClipCursorPresentationAtSourceTime } from "./clipCursorPresentation";
import type { ClipRegion } from "./types";

describe("getClipCursorPresentationAtSourceTime", () => {
	const clips: ClipRegion[] = [
		{ id: "normal", startMs: 0, endMs: 1_000, speed: 1 },
		{
			id: "private",
			startMs: 1_000,
			endMs: 2_000,
			speed: 1,
			hideCursor: true,
			disableCursorSmoothing: true,
		},
		{
			id: "fast",
			startMs: 2_000,
			endMs: 2_500,
			speed: 2,
			disableCursorSmoothing: true,
		},
	];

	it("uses end-exclusive clip boundaries", () => {
		expect(getClipCursorPresentationAtSourceTime(clips, 999)).toEqual({
			visible: true,
			smoothingEnabled: true,
			clipId: "normal",
		});
		expect(getClipCursorPresentationAtSourceTime(clips, 1_000)).toEqual({
			visible: false,
			smoothingEnabled: false,
			clipId: "private",
		});
	});

	it("covers a sped-up clip's full source-media span", () => {
		expect(getClipCursorPresentationAtSourceTime(clips, 2_900)).toEqual({
			visible: true,
			smoothingEnabled: false,
			clipId: "fast",
		});
	});

	it("falls back to global cursor behavior outside clips", () => {
		expect(getClipCursorPresentationAtSourceTime(clips, 3_000)).toEqual({
			visible: true,
			smoothingEnabled: true,
			clipId: null,
		});
	});
});
