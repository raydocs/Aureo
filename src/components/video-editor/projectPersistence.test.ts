import { describe, expect, it } from "vitest";

import { normalizeProjectEditor } from "./projectPersistence";
import { ADVANCED_VERTICAL_PADDING_MAX } from "./types";

describe("normalizeProjectEditor", () => {
	it("persists idle cursor hiding while keeping it opt-in by default", () => {
		expect(normalizeProjectEditor({}).hideCursorWhenIdle).toBe(false);
		expect(normalizeProjectEditor({ hideCursorWhenIdle: true }).hideCursorWhenIdle).toBe(true);
	});

	it("stops cursor movement at the end by default and persists the override", () => {
		expect(normalizeProjectEditor({}).stopCursorAtEnd).toBe(true);
		expect(normalizeProjectEditor({ stopCursorAtEnd: false }).stopCursorAtEnd).toBe(false);
	});

	it("persists cursor shake removal while keeping it opt-in by default", () => {
		expect(normalizeProjectEditor({}).removeCursorShakes).toBe(false);
		expect(normalizeProjectEditor({ removeCursorShakes: true }).removeCursorShakes).toBe(true);
	});

	it("persists advanced cursor-type controls while keeping them opt-in", () => {
		expect(normalizeProjectEditor({})).toMatchObject({
			alwaysUseDefaultCursor: false,
			optimizeCursorTypes: false,
		});
		expect(
			normalizeProjectEditor({ alwaysUseDefaultCursor: true, optimizeCursorTypes: true }),
		).toMatchObject({ alwaysUseDefaultCursor: true, optimizeCursorTypes: true });
	});

	it("preserves the extended advanced vertical padding range", () => {
		const editor = normalizeProjectEditor({
			padding: {
				top: 240,
				bottom: ADVANCED_VERTICAL_PADDING_MAX,
				left: 22,
				right: 22,
				linked: false,
			},
		});

		expect(editor.padding).toMatchObject({
			top: 240,
			bottom: ADVANCED_VERTICAL_PADDING_MAX,
			left: 22,
			right: 22,
			linked: false,
		});
	});

	it("keeps linked padding clamped to the original range", () => {
		const editor = normalizeProjectEditor({
			padding: {
				top: ADVANCED_VERTICAL_PADDING_MAX,
				bottom: ADVANCED_VERTICAL_PADDING_MAX,
				left: ADVANCED_VERTICAL_PADDING_MAX,
				right: ADVANCED_VERTICAL_PADDING_MAX,
				linked: true,
			},
		});

		expect(editor.padding).toMatchObject({
			top: 100,
			bottom: 100,
			left: 100,
			right: 100,
			linked: true,
		});
	});

	it("normalizes persisted dynamic webcam layouts", () => {
		const editor = normalizeProjectEditor({
			webcam: {
				layouts: [
					{ id: "intro", startMs: 800.4, endMs: 3200.7, mode: "fullscreen" },
					{ id: "hide", startMs: 5000, endMs: 4900, mode: "hidden" },
				],
			} as never,
		});

		expect(editor.webcam.layouts).toEqual([
			{ id: "intro", startMs: 800, endMs: 3201, mode: "fullscreen" },
			{ id: "hide", startMs: 5000, endMs: 5001, mode: "hidden" },
		]);
	});

	it("preserves per-clip cursor presentation overrides", () => {
		const editor = normalizeProjectEditor({
			clipRegions: [
				{
					id: "clip-private",
					startMs: 0,
					endMs: 2_000,
					speed: 1,
					hideCursor: true,
					disableCursorSmoothing: true,
				},
			],
		});

		expect(editor.clipRegions[0]).toMatchObject({
			hideCursor: true,
			disableCursorSmoothing: true,
		});
	});

	it("normalizes persisted highlight masks and their disabled state", () => {
		const editor = normalizeProjectEditor({
			annotationRegions: [
				{
					id: "mask-highlight",
					startMs: 100,
					endMs: 1_100,
					type: "highlight",
					content: "",
					position: { x: 12, y: 18 },
					size: { width: 40, height: 24 },
					style: {} as never,
					zIndex: 1,
					highlightOpacity: 1.8,
					disabled: true,
				},
			],
		});

		expect(editor.annotationRegions[0]).toMatchObject({
			type: "highlight",
			highlightOpacity: 1,
			disabled: true,
		});
	});
});
