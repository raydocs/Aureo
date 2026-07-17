import type { Span } from "dnd-timeline";
import type { ShortcutBinding } from "@/lib/shortcuts";
import type { AnnotationType, WebcamLayoutMode, ZoomMode } from "../../types";

export interface TimelineRegionSpan {
	id: string;
	start: number;
	end: number;
	rowId: string;
}

export interface TimelineRegion {
	id: string;
	startMs: number;
	endMs: number;
}

export interface TimelineAudioRegion extends TimelineRegion {
	trackIndex?: number;
}

export interface TimelineShortcutBindings {
	addKeyframe: ShortcutBinding;
	addZoom: ShortcutBinding;
	splitClip: ShortcutBinding;
	addAnnotation: ShortcutBinding;
	deleteSelected: ShortcutBinding;
}

export interface TimelineRenderItem {
	id: string;
	rowId: string;
	span: Span;
	sourceSpan?: Span;
	label: string;
	audioPath?: string;
	audioGain?: number;
	audioNormalize?: boolean;
	zoomDepth?: number;
	zoomMode?: ZoomMode;
	webcamLayoutMode?: WebcamLayoutMode;
	speedValue?: number;
	showSourceAudio?: boolean;
	muted?: boolean;
	hideCursor?: boolean;
	disableCursorSmoothing?: boolean;
	maskType?: Extract<AnnotationType, "blur" | "highlight">;
	maskOpacity?: number;
	maskDisabled?: boolean;
	variant:
		| "zoom"
		| "trim"
		| "clip"
		| "annotation"
		| "mask"
		| "speed"
		| "audio"
		| "caption"
		| "webcam-layout";
}

export interface AudioPeaksData {
	durationMs: number;
	peaks: Float32Array;
}
