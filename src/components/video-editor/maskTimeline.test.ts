import { describe, expect, it } from "vitest";
import type { AnnotationRegion } from "./types";
import { hasMaskOverlap, isMaskAnnotation, resolveMaskSpanAtMs } from "./maskTimeline";

const annotation = (
	id: string,
	type: AnnotationRegion["type"],
	startMs: number,
	endMs: number,
): AnnotationRegion => ({ id, type, startMs, endMs }) as AnnotationRegion;

describe("mask timeline", () => {
	it("treats sensitive-data and highlight regions as one mask family", () => {
		expect(isMaskAnnotation(annotation("blur", "blur", 0, 1))).toBe(true);
		expect(isMaskAnnotation(annotation("highlight", "highlight", 0, 1))).toBe(true);
		expect(isMaskAnnotation(annotation("text", "text", 0, 1))).toBe(false);
	});

	it("clamps a new mask before the next mask and rejects occupied frames", () => {
		const annotations = [
			annotation("text", "text", 0, 9_000),
			annotation("existing", "highlight", 4_000, 6_000),
		];

		expect(
			resolveMaskSpanAtMs({
				annotations,
				startMs: 2_000,
				totalMs: 10_000,
				defaultDurationMs: 3_000,
			}),
		).toEqual({ start: 2_000, end: 4_000 });
		expect(
			resolveMaskSpanAtMs({
				annotations,
				startMs: 4_500,
				totalMs: 10_000,
				defaultDurationMs: 3_000,
			}),
		).toBeNull();
	});

	it("allows adjacent masks but never overlapping mask/highlight frames", () => {
		const annotations = [annotation("existing", "blur", 1_000, 2_000)];
		expect(hasMaskOverlap(annotations, { start: 2_000, end: 3_000 })).toBe(false);
		expect(hasMaskOverlap(annotations, { start: 1_999, end: 3_000 })).toBe(true);
	});
});
