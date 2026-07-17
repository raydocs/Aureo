import { describe, expect, it, vi } from "vitest";
import type { AnnotationRegion } from "@/components/video-editor/types";
import { renderAnnotations } from "./annotationRenderer";

function createHighlight(overrides: Partial<AnnotationRegion> = {}): AnnotationRegion {
	return {
		id: "highlight-1",
		startMs: 0,
		endMs: 1_000,
		type: "highlight",
		content: "",
		position: { x: 25, y: 20 },
		size: { width: 50, height: 30 },
		style: {
			color: "#fff",
			backgroundColor: "transparent",
			fontSize: 24,
			fontFamily: "Inter",
			fontWeight: "normal",
			fontStyle: "normal",
			textDecoration: "none",
			textAlign: "center",
			borderRadius: 8,
		},
		zIndex: 1,
		highlightOpacity: 0.54,
		...overrides,
	};
}

function createContext() {
	return {
		save: vi.fn(),
		restore: vi.fn(),
		beginPath: vi.fn(),
		rect: vi.fn(),
		roundRect: vi.fn(),
		clip: vi.fn(),
		fillRect: vi.fn(),
		fillStyle: "",
	} as unknown as CanvasRenderingContext2D;
}

describe("annotation highlight rendering", () => {
	it("dims the recording outside the rounded highlight rectangle", async () => {
		const context = createContext();
		await renderAnnotations(context, [createHighlight()], 1_000, 500, 500);

		expect(context.rect).toHaveBeenCalledWith(0, 0, 1_000, 500);
		expect(context.roundRect).toHaveBeenCalledWith(250, 100, 500, 150, 8);
		expect(context.clip).toHaveBeenCalledWith("evenodd");
		expect(context.fillStyle).toBe("rgba(0, 0, 0, 0.54)");
		expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1_000, 500);
	});

	it("keeps disabled masks in project data without rendering them", async () => {
		const context = createContext();
		await renderAnnotations(context, [createHighlight({ disabled: true })], 1_000, 500, 500);
		expect(context.fillRect).not.toHaveBeenCalled();
	});
});
