import type { CSSProperties } from "react";

/** Same curve family as the editor squircle (squircle.ts SQUIRCLE_EXPONENT 4.5): exponent = 2^K. */
export const WEBCAM_SQUIRCLE_SUPERELLIPSE_K = Math.log2(4.5);

export function getWebcamPreviewShapeStyle(roundness: number): CSSProperties {
	const clamped = Number.isFinite(roundness) ? Math.min(100, Math.max(0, roundness)) : 100;

	const style: Record<string, string> = {
		borderRadius: `${clamped / 2}%`,
	};

	if (clamped > 0 && clamped < 100) {
		style.cornerShape = `superellipse(${WEBCAM_SQUIRCLE_SUPERELLIPSE_K.toFixed(4)})`;
	}

	return style as CSSProperties;
}
