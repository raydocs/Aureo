export type CaptureRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type CaptureDisplay = {
	id: string;
	bounds: CaptureRect;
	scaleFactor: number;
};

export type AreaCaptureSegment = {
	displayId: string;
	displayScaleFactor: number;
	sourceRect: CaptureRect;
	outputRect: CaptureRect;
	captureSize: { width: number; height: number };
};

export type AreaCaptureLayout = {
	selection: CaptureRect;
	outputScaleFactor: number;
	outputSize: { width: number; height: number };
	segments: AreaCaptureSegment[];
};

export const MIN_AREA_SELECTION_DIP = 2;

function roundToPixel(value: number): number {
	return Math.round(value);
}

export function normalizeCaptureRect(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
): CaptureRect {
	return {
		x: Math.min(startX, endX),
		y: Math.min(startY, endY),
		width: Math.abs(endX - startX),
		height: Math.abs(endY - startY),
	};
}

export function intersectCaptureRects(first: CaptureRect, second: CaptureRect): CaptureRect | null {
	const x = Math.max(first.x, second.x);
	const y = Math.max(first.y, second.y);
	const right = Math.min(first.x + first.width, second.x + second.width);
	const bottom = Math.min(first.y + first.height, second.y + second.height);

	if (right <= x || bottom <= y) {
		return null;
	}

	return { x, y, width: right - x, height: bottom - y };
}

/**
 * Union bounds for the full virtual desktop in global DIP coordinates.
 * Supports negative origins when displays sit left/above the primary.
 */
export function getVirtualDesktopBounds(displays: readonly CaptureDisplay[]): CaptureRect | null {
	if (displays.length === 0) {
		return null;
	}

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxRight = Number.NEGATIVE_INFINITY;
	let maxBottom = Number.NEGATIVE_INFINITY;

	for (const display of displays) {
		const { x, y, width, height } = display.bounds;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxRight = Math.max(maxRight, x + width);
		maxBottom = Math.max(maxBottom, y + height);
	}

	if (
		!Number.isFinite(minX) ||
		!Number.isFinite(minY) ||
		!Number.isFinite(maxRight) ||
		!Number.isFinite(maxBottom)
	) {
		return null;
	}

	const width = maxRight - minX;
	const height = maxBottom - minY;
	if (width <= 0 || height <= 0) {
		return null;
	}

	return { x: minX, y: minY, width, height };
}

/** Convert a rect from overlay-window local DIP into global desktop DIP. */
export function windowLocalRectToGlobal(
	windowBounds: CaptureRect,
	localRect: CaptureRect,
): CaptureRect {
	return {
		x: windowBounds.x + localRect.x,
		y: windowBounds.y + localRect.y,
		width: localRect.width,
		height: localRect.height,
	};
}

export function isValidAreaSelection(
	rect: CaptureRect,
	minSize: number = MIN_AREA_SELECTION_DIP,
): boolean {
	return (
		Number.isFinite(rect.x) &&
		Number.isFinite(rect.y) &&
		Number.isFinite(rect.width) &&
		Number.isFinite(rect.height) &&
		rect.width >= minSize &&
		rect.height >= minSize
	);
}

export function createAreaCaptureLayout(
	selection: CaptureRect,
	displays: readonly CaptureDisplay[],
): AreaCaptureLayout | null {
	if (selection.width <= 0 || selection.height <= 0) {
		return null;
	}

	const intersections = displays
		.map((display) => ({
			display,
			intersection: intersectCaptureRects(selection, display.bounds),
		}))
		.filter(
			(entry): entry is { display: CaptureDisplay; intersection: CaptureRect } =>
				entry.intersection !== null,
		);

	if (intersections.length === 0) {
		return null;
	}

	const outputScaleFactor = Math.max(
		1,
		...intersections.map(({ display }) => display.scaleFactor),
	);
	const segments = intersections.map(({ display, intersection }) => {
		const sourceRect = {
			x: intersection.x - display.bounds.x,
			y: intersection.y - display.bounds.y,
			width: intersection.width,
			height: intersection.height,
		};

		return {
			displayId: display.id,
			displayScaleFactor: display.scaleFactor,
			sourceRect,
			outputRect: {
				x: roundToPixel((intersection.x - selection.x) * outputScaleFactor),
				y: roundToPixel((intersection.y - selection.y) * outputScaleFactor),
				width: roundToPixel(intersection.width * outputScaleFactor),
				height: roundToPixel(intersection.height * outputScaleFactor),
			},
			captureSize: {
				width: roundToPixel(intersection.width * display.scaleFactor),
				height: roundToPixel(intersection.height * display.scaleFactor),
			},
		};
	});

	return {
		selection,
		outputScaleFactor,
		outputSize: {
			width: roundToPixel(selection.width * outputScaleFactor),
			height: roundToPixel(selection.height * outputScaleFactor),
		},
		segments,
	};
}

export function buildAreaSelectedSource(layout: AreaCaptureLayout): {
	id: string;
	name: string;
	display_id: string;
	sourceType: "area";
	geometry: AreaCaptureLayout;
	thumbnail: null;
	appIcon: null;
} {
	const { x, y, width, height } = layout.selection;
	const primaryDisplayId = layout.segments[0]?.displayId ?? "";
	return {
		id: `area:${Math.round(x)},${Math.round(y)},${Math.round(width)}x${Math.round(height)}`,
		name: `Area ${Math.round(width)}×${Math.round(height)}`,
		display_id: primaryDisplayId,
		sourceType: "area",
		geometry: layout,
		thumbnail: null,
		appIcon: null,
	};
}
