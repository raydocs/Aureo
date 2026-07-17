import type { WebcamPreviewFitMode } from "./webcamPreviewAppearance";

export interface WebcamCropRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface WebcamFramingInput {
	zoom: number;
	fitMode: WebcamPreviewFitMode;
	centerX: number;
	centerY: number;
	mirror: boolean;
}

export interface WebcamFramingLayout {
	video: { left: number; top: number; width: number; height: number };
	showBackdrop: boolean;
	clampedCenter: { x: number; y: number };
	pannableX: boolean;
	pannableY: boolean;
	cropRegion: WebcamCropRegion;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function resolveVideoAspect(videoAspect: number): number {
	return typeof videoAspect === "number" && Number.isFinite(videoAspect) && videoAspect > 0
		? videoAspect
		: 16 / 9;
}

function round3(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/**
 * Pure framing layout for the floating webcam preview.
 * Source is modeled as vw = videoAspect, vh = 1.
 * cropRegion is always in UNMIRRORED source coordinates.
 */
export function computeWebcamFramingLayout(
	input: WebcamFramingInput,
	container: { width: number; height: number },
	videoAspect: number,
): WebcamFramingLayout {
	const Wc = container.width;
	const Hc = container.height;
	const vw = resolveVideoAspect(videoAspect);
	const vh = 1;

	const coverScale = Math.max(Wc / vw, Hc / vh);
	const containScale = Math.min(Wc / vw, Hc / vh);
	const s = input.zoom * (input.fitMode === "fill" ? coverScale : containScale);
	const dw = vw * s;
	const dh = vh * s;

	const pannableX = dw >= Wc;
	const pannableY = dh >= Hc;

	let left: number;
	if (pannableX) {
		const anchorX = input.mirror ? 1 - input.centerX : input.centerX;
		left = clamp(Wc / 2 - dw * anchorX, Wc - dw, 0);
	} else {
		left = (Wc - dw) / 2;
	}

	let top: number;
	if (pannableY) {
		top = clamp(Hc / 2 - dh * input.centerY, Hc - dh, 0);
	} else {
		top = (Hc - dh) / 2;
	}

	const cropW = Math.min(1, Wc / dw);
	const cropH = Math.min(1, Hc / dh);
	// Derive crop in unmirrored source coords — mirror must not change crop x/y.
	const x = clamp(input.centerX - cropW / 2, 0, 1 - cropW);
	const y = clamp(input.centerY - cropH / 2, 0, 1 - cropH);

	const clampedCenter = {
		x: pannableX ? x + cropW / 2 : input.centerX,
		y: pannableY ? y + cropH / 2 : input.centerY,
	};

	return {
		video: { left, top, width: dw, height: dh },
		showBackdrop: dw < Wc - 0.5 || dh < Hc - 0.5,
		clampedCenter,
		pannableX,
		pannableY,
		cropRegion: { x, y, width: cropW, height: cropH },
	};
}

/**
 * Apply a pointer drag (container px) to framing centers.
 * Letterboxed axes ignore the delta so a hidden offset cannot reappear on zoom-in.
 */
export function applyWebcamFramingDrag(
	layout: WebcamFramingLayout,
	deltaPx: { x: number; y: number },
	input: WebcamFramingInput,
): { centerX: number; centerY: number } {
	const dw = layout.video.width;
	const dh = layout.video.height;
	const cropW = layout.cropRegion.width;
	const cropH = layout.cropRegion.height;

	let centerX = input.centerX;
	let centerY = input.centerY;

	if (layout.pannableX && dw > 0) {
		const deltaCenterX = (input.mirror ? deltaPx.x : -deltaPx.x) / dw;
		centerX = input.centerX + deltaCenterX;
		// Keep recomputed crop inside 0..1
		const x = clamp(centerX - cropW / 2, 0, 1 - cropW);
		centerX = x + cropW / 2;
	}

	if (layout.pannableY && dh > 0) {
		const deltaCenterY = -deltaPx.y / dh;
		centerY = input.centerY + deltaCenterY;
		const y = clamp(centerY - cropH / 2, 0, 1 - cropH);
		centerY = y + cropH / 2;
	}

	return {
		centerX: round3(centerX),
		centerY: round3(centerY),
	};
}
