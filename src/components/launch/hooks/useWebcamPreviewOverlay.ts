import {
	type KeyboardEvent,
	type PointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { canShowFloatingWebcamPreview } from "../floatingWebcamPreview";
import {
	cacheWebcamPreviewAppearance,
	clampWebcamPreviewSizeToViewport,
	loadWebcamPreviewAppearance,
	normalizeWebcamPreviewAppearance,
	saveWebcamPreviewAppearance,
	WEBCAM_PREVIEW_SIZE_RANGE,
	type WebcamPreviewAppearance,
} from "../webcamPreviewAppearance";
import {
	applyWebcamFramingDrag,
	computeWebcamFramingLayout,
	type WebcamFramingLayout,
} from "../webcamPreviewFraming";
import {
	loadWebcamPreviewPlacement,
	resolveViewportConstrainedPreview,
	saveWebcamPreviewPlacement,
	type WebcamPreviewPlacement,
} from "../webcamPreviewPlacement";
import { WEBCAM_PREVIEW_SNAP_SIZES } from "../webcamPreviewPresets";
import {
	computeKeyboardResizedPreviewBox,
	computeResizedPreviewBox,
	type WebcamResizeCorner,
} from "../webcamPreviewResize";

const WEBCAM_PREVIEW_DRAG_THRESHOLD = 6;
const DEFAULT_VIDEO_ASPECT = 16 / 9;
const APPEARANCE_SAVE_DEBOUNCE_MS = 200;
const PLACEMENT_SAVE_DEBOUNCE_MS = 250;

interface InitialWebcamPreviewState {
	appearance: WebcamPreviewAppearance;
	preferredSize: number;
	offset: { x: number; y: number };
	visible: boolean;
}

function createInitialWebcamPreviewState(): InitialWebcamPreviewState {
	const loadedAppearance = loadWebcamPreviewAppearance();
	const viewport = { width: window.innerWidth, height: window.innerHeight };
	const constrained = resolveViewportConstrainedPreview({
		size: loadedAppearance.size,
		placement: loadWebcamPreviewPlacement(),
		viewport,
	});
	const appearance =
		constrained.size === loadedAppearance.size
			? loadedAppearance
			: { ...loadedAppearance, size: constrained.size };
	// Runtime-only undersized values must not overwrite the persisted preferred size.
	cacheWebcamPreviewAppearance(appearance);
	return {
		appearance,
		preferredSize: loadedAppearance.size,
		offset: { x: constrained.placement.offsetX, y: constrained.placement.offsetY },
		visible: constrained.placement.visible,
	};
}

function isDeviceConstraintError(error: unknown): boolean {
	const name =
		error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
	return name === "OverconstrainedError" || name === "NotFoundError";
}

function isNotAllowedError(error: unknown): boolean {
	const name =
		error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
	return name === "NotAllowedError";
}

function buildPreviewVideoConstraints(deviceId?: string): MediaTrackConstraints {
	const base: MediaTrackConstraints = {
		width: { ideal: 640 },
		height: { ideal: 360 },
		aspectRatio: { ideal: 16 / 9 },
		frameRate: { ideal: 24, max: 30 },
	};
	if (deviceId) {
		return { ...base, deviceId: { exact: deviceId } };
	}
	return base;
}

export function useWebcamPreviewOverlay({
	webcamEnabled,
	webcamDeviceId,
	showWebcamControls,
	webcamPopoverOpen,
	hudOverlayMousePassthroughSupported,
	onWebcamPreviewUnavailable,
}: {
	webcamEnabled: boolean;
	webcamDeviceId?: string;
	showWebcamControls: boolean;
	webcamPopoverOpen: boolean;
	hudOverlayMousePassthroughSupported: boolean | null;
	onWebcamPreviewUnavailable?: () => void;
}) {
	const initialStateRef = useRef<InitialWebcamPreviewState | null>(null);
	if (initialStateRef.current === null) {
		initialStateRef.current = createInitialWebcamPreviewState();
	}
	const initialState = initialStateRef.current;

	const [showFloatingWebcamPreview, setShowFloatingWebcamPreview] = useState(
		initialState.visible,
	);
	const [webcamPreviewAppearance, setWebcamPreviewAppearance] = useState(initialState.appearance);
	const [webcamPreviewOffset, setWebcamPreviewOffset] = useState(initialState.offset);
	const [videoAspect, setVideoAspect] = useState(DEFAULT_VIDEO_ASPECT);
	const webcamPreviewOffsetRef = useRef(initialState.offset);
	const webcamPreviewAppearanceRef = useRef(webcamPreviewAppearance);
	const preferredWebcamPreviewSizeRef = useRef(initialState.preferredSize);
	const videoAspectRef = useRef(videoAspect);
	const appearanceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingAppearanceSaveRef = useRef<WebcamPreviewAppearance | null>(null);
	const placementSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingPlacementSaveRef = useRef<WebcamPreviewPlacement | null>(null);
	const previewVideoNodesRef = useRef(new Set<HTMLVideoElement>());
	const metadataListenerByNodeRef = useRef(new Map<HTMLVideoElement, () => void>());
	const recordingWebcamPreviewContainerRef = useRef<HTMLDivElement | null>(null);
	const previewStreamRef = useRef<MediaStream | null>(null);
	const previewDragMoveRafRef = useRef<number | null>(null);
	const previewDragPendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
	const previewResizeMoveRafRef = useRef<number | null>(null);
	const previewResizePendingPointerRef = useRef<{
		clientX: number;
		clientY: number;
		centerScale: boolean;
		quantize: boolean;
	} | null>(null);
	const previewResizeResultRef = useRef<ReturnType<typeof computeResizedPreviewBox> | null>(null);
	const previewFramingMoveRafRef = useRef<number | null>(null);
	const previewFramingPendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(
		null,
	);
	const previewFramingResultRef = useRef<{ centerX: number; centerY: number } | null>(null);
	const recordingWebcamPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
	const webcamPreviewSizePillRef = useRef<HTMLDivElement | null>(null);
	const keyboardResizePillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const webcamPreviewPassthroughHeldRef = useRef(false);
	const previewUnavailableNotifiedRef = useRef(false);
	const onWebcamPreviewUnavailableRef = useRef(onWebcamPreviewUnavailable);
	onWebcamPreviewUnavailableRef.current = onWebcamPreviewUnavailable;

	webcamPreviewAppearanceRef.current = webcamPreviewAppearance;
	videoAspectRef.current = videoAspect;
	const webcamPreviewDragStartRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		originX: number;
		originY: number;
		initialLeft: number;
		initialTop: number;
		previewWidth: number;
		previewHeight: number;
		dragging: boolean;
	} | null>(null);
	const webcamFramingDragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		startCenterX: number;
		startCenterY: number;
		layoutAtStart: WebcamFramingLayout;
	} | null>(null);
	const isWebcamPreviewDraggingRef = useRef(false);
	const webcamPreviewResizeStartRef = useRef<{
		corner: WebcamResizeCorner;
		pointerId: number;
		startX: number;
		startY: number;
		startSize: number;
		startOffset: { x: number; y: number };
	} | null>(null);
	const isWebcamPreviewResizingRef = useRef(false);
	const showRecordingWebcamPreview =
		webcamEnabled &&
		canShowFloatingWebcamPreview(
			showFloatingWebcamPreview,
			hudOverlayMousePassthroughSupported,
		);
	const shouldStreamWebcamPreview =
		webcamEnabled && (showRecordingWebcamPreview || (showWebcamControls && webcamPopoverOpen));

	const holdHudPassthrough = useCallback(() => {
		window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
		webcamPreviewPassthroughHeldRef.current = true;
	}, []);

	const releaseHudPassthrough = useCallback(() => {
		if (!webcamPreviewPassthroughHeldRef.current) {
			return;
		}
		window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
		webcamPreviewPassthroughHeldRef.current = false;
	}, []);

	const flushWebcamPreviewAppearanceSave = useCallback(() => {
		if (appearanceSaveTimerRef.current !== null) {
			clearTimeout(appearanceSaveTimerRef.current);
			appearanceSaveTimerRef.current = null;
		}
		const pending = pendingAppearanceSaveRef.current;
		if (pending !== null) {
			saveWebcamPreviewAppearance(pending);
			pendingAppearanceSaveRef.current = null;
		}
	}, []);

	const flushWebcamPreviewPlacementSave = useCallback(() => {
		if (placementSaveTimerRef.current !== null) {
			clearTimeout(placementSaveTimerRef.current);
			placementSaveTimerRef.current = null;
		}
		const pending = pendingPlacementSaveRef.current;
		if (pending !== null) {
			saveWebcamPreviewPlacement(pending);
			pendingPlacementSaveRef.current = null;
		}
	}, []);

	const updateWebcamPreviewAppearance = useCallback((patch: Partial<WebcamPreviewAppearance>) => {
		const current = webcamPreviewAppearanceRef.current;
		const normalized = normalizeWebcamPreviewAppearance({
			...current,
			...patch,
		});
		const next =
			patch.size === undefined && current.size < WEBCAM_PREVIEW_SIZE_RANGE.min
				? { ...normalized, size: current.size }
				: normalized;
		webcamPreviewAppearanceRef.current = next;
		if (patch.size !== undefined) {
			preferredWebcamPreviewSizeRef.current = next.size;
		}
		cacheWebcamPreviewAppearance(next);
		setWebcamPreviewAppearance(next);

		// Keep UI live; debounce the sync IPC disk write (~200ms trailing).
		pendingAppearanceSaveRef.current = next;
		if (appearanceSaveTimerRef.current !== null) {
			clearTimeout(appearanceSaveTimerRef.current);
		}
		appearanceSaveTimerRef.current = setTimeout(() => {
			appearanceSaveTimerRef.current = null;
			const pending = pendingAppearanceSaveRef.current;
			if (pending !== null) {
				saveWebcamPreviewAppearance(pending);
				pendingAppearanceSaveRef.current = null;
			}
		}, APPEARANCE_SAVE_DEBOUNCE_MS);
	}, []);

	useEffect(() => {
		return () => {
			flushWebcamPreviewAppearanceSave();
		};
	}, [flushWebcamPreviewAppearanceSave]);

	useEffect(() => {
		pendingPlacementSaveRef.current = {
			offsetX: webcamPreviewOffset.x,
			offsetY: webcamPreviewOffset.y,
			visible: showFloatingWebcamPreview,
		};
		if (placementSaveTimerRef.current !== null) {
			clearTimeout(placementSaveTimerRef.current);
		}
		placementSaveTimerRef.current = setTimeout(() => {
			placementSaveTimerRef.current = null;
			const pending = pendingPlacementSaveRef.current;
			if (pending !== null) {
				saveWebcamPreviewPlacement(pending);
				pendingPlacementSaveRef.current = null;
			}
		}, PLACEMENT_SAVE_DEBOUNCE_MS);

		return () => {
			// Cleanup only clears the timer; flush on unmount is separate so
			// dependency changes do not write intermediate states twice.
			if (placementSaveTimerRef.current !== null) {
				clearTimeout(placementSaveTimerRef.current);
				placementSaveTimerRef.current = null;
			}
		};
	}, [webcamPreviewOffset, showFloatingWebcamPreview]);

	useEffect(() => {
		return () => {
			flushWebcamPreviewPlacementSave();
		};
	}, [flushWebcamPreviewPlacementSave]);

	// Webcam off: clear gesture state only — position and visibility stay sticky.
	useEffect(() => {
		if (!webcamEnabled) {
			webcamPreviewDragStartRef.current = null;
			webcamFramingDragRef.current = null;
			isWebcamPreviewDraggingRef.current = false;
			if (previewDragMoveRafRef.current !== null) {
				cancelAnimationFrame(previewDragMoveRafRef.current);
				previewDragMoveRafRef.current = null;
			}
			previewDragPendingPointerRef.current = null;
			if (previewFramingMoveRafRef.current !== null) {
				cancelAnimationFrame(previewFramingMoveRafRef.current);
				previewFramingMoveRafRef.current = null;
			}
			previewFramingPendingPointerRef.current = null;
			previewFramingResultRef.current = null;
			webcamPreviewResizeStartRef.current = null;
			isWebcamPreviewResizingRef.current = false;
			if (previewResizeMoveRafRef.current !== null) {
				cancelAnimationFrame(previewResizeMoveRafRef.current);
				previewResizeMoveRafRef.current = null;
			}
			previewResizePendingPointerRef.current = null;
			previewResizeResultRef.current = null;
			recordingWebcamPreviewContainerRef.current?.removeAttribute("data-resizing");
			recordingWebcamPreviewContainerRef.current?.removeAttribute("data-framing");
			webcamPreviewSizePillRef.current?.removeAttribute("data-visible");
			releaseHudPassthrough();
		} else {
			previewUnavailableNotifiedRef.current = false;
		}
	}, [webcamEnabled, releaseHudPassthrough]);

	// Passthrough fail-safe: restore click-through if a gesture is interrupted.
	useEffect(() => {
		const restoreIfHeld = () => {
			releaseHudPassthrough();
		};

		const onBlur = () => {
			restoreIfHeld();
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				restoreIfHeld();
			}
		};

		window.addEventListener("blur", onBlur);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			window.removeEventListener("blur", onBlur);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			restoreIfHeld();
		};
	}, [releaseHudPassthrough]);

	const applyRuntimePreviewSize = useCallback((nextSize: number) => {
		const current = webcamPreviewAppearanceRef.current;
		if (current.size === nextSize) {
			return;
		}
		// Viewport fits are runtime-only: never overwrite the user's preferred size on disk.
		// Values inside the normal range still skip normalize so a temporary undershoot
		// path stays consistent; pointer-up persists intentional resizes separately.
		const next =
			nextSize >= WEBCAM_PREVIEW_SIZE_RANGE.min
				? normalizeWebcamPreviewAppearance({ ...current, size: nextSize })
				: { ...current, size: nextSize };
		webcamPreviewAppearanceRef.current = next;
		cacheWebcamPreviewAppearance(next);
		setWebcamPreviewAppearance(next);
	}, []);

	const keepWebcamPreviewInsideViewport = useCallback(() => {
		if (
			isWebcamPreviewDraggingRef.current ||
			isWebcamPreviewResizingRef.current ||
			!recordingWebcamPreviewContainerRef.current
		) {
			return;
		}

		const viewport = { width: window.innerWidth, height: window.innerHeight };
		const constrained = resolveViewportConstrainedPreview({
			size: preferredWebcamPreviewSizeRef.current,
			placement: {
				offsetX: webcamPreviewOffsetRef.current.x,
				offsetY: webcamPreviewOffsetRef.current.y,
				visible: true,
			},
			viewport,
		});

		const shell = recordingWebcamPreviewContainerRef.current;
		if (constrained.size !== webcamPreviewAppearanceRef.current.size) {
			applyRuntimePreviewSize(constrained.size);
			shell.style.width = `${constrained.size}px`;
			shell.style.height = `${constrained.size}px`;
		}

		const nextOffset = {
			x: constrained.placement.offsetX,
			y: constrained.placement.offsetY,
		};
		if (
			nextOffset.x === webcamPreviewOffsetRef.current.x &&
			nextOffset.y === webcamPreviewOffsetRef.current.y
		) {
			return;
		}

		webcamPreviewOffsetRef.current = nextOffset;
		shell.style.transform = `translate(${nextOffset.x}px, ${nextOffset.y}px)`;
		setWebcamPreviewOffset(nextOffset);
	}, [applyRuntimePreviewSize]);

	useEffect(() => {
		window.addEventListener("resize", keepWebcamPreviewInsideViewport);
		return () => {
			window.removeEventListener("resize", keepWebcamPreviewInsideViewport);
		};
	}, [keepWebcamPreviewInsideViewport]);

	const applyPendingWebcamPreviewFraming = useCallback(() => {
		const drag = webcamFramingDragRef.current;
		const pointer = previewFramingPendingPointerRef.current;
		if (!drag || !pointer) {
			return;
		}

		previewFramingPendingPointerRef.current = null;
		const appearance = webcamPreviewAppearanceRef.current;
		const next = applyWebcamFramingDrag(
			drag.layoutAtStart,
			{
				x: pointer.clientX - drag.startX,
				y: pointer.clientY - drag.startY,
			},
			{
				zoom: appearance.zoom,
				fitMode: "fill",
				centerX: drag.startCenterX,
				centerY: drag.startCenterY,
				mirror: appearance.mirror,
			},
		);
		previewFramingResultRef.current = next;

		const layout = computeWebcamFramingLayout(
			{
				zoom: appearance.zoom,
				fitMode: "fill",
				centerX: next.centerX,
				centerY: next.centerY,
				mirror: appearance.mirror,
			},
			{ width: appearance.size, height: appearance.size },
			videoAspectRef.current,
		);
		const video = recordingWebcamPreviewVideoRef.current;
		if (video) {
			video.style.left = `${layout.video.left}px`;
			video.style.top = `${layout.video.top}px`;
		}
	}, []);

	const handleWebcamPreviewPointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}

			if (event.altKey) {
				const appearance = webcamPreviewAppearanceRef.current;
				const layout = computeWebcamFramingLayout(
					{
						zoom: appearance.zoom,
						fitMode: "fill",
						centerX: appearance.centerX,
						centerY: appearance.centerY,
						mirror: appearance.mirror,
					},
					{ width: appearance.size, height: appearance.size },
					videoAspectRef.current,
				);
				if (layout.pannableX || layout.pannableY) {
					event.preventDefault();
					holdHudPassthrough();
					event.currentTarget.setPointerCapture(event.pointerId);
					webcamFramingDragRef.current = {
						pointerId: event.pointerId,
						startX: event.clientX,
						startY: event.clientY,
						startCenterX: appearance.centerX,
						startCenterY: appearance.centerY,
						layoutAtStart: layout,
					};
					previewFramingPendingPointerRef.current = null;
					previewFramingResultRef.current = null;
					isWebcamPreviewDraggingRef.current = true;
					recordingWebcamPreviewContainerRef.current?.setAttribute("data-framing", "");
					return;
				}
			}

			const previewRect = event.currentTarget.getBoundingClientRect();

			event.preventDefault();
			holdHudPassthrough();
			webcamPreviewDragStartRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				originX: webcamPreviewOffsetRef.current.x,
				originY: webcamPreviewOffsetRef.current.y,
				initialLeft: previewRect.left,
				initialTop: previewRect.top,
				previewWidth: previewRect.width,
				previewHeight: previewRect.height,
				dragging: false,
			};
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[holdHudPassthrough],
	);

	const handleWebcamPreviewPointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const framingDrag = webcamFramingDragRef.current;
			if (framingDrag && framingDrag.pointerId === event.pointerId) {
				previewFramingPendingPointerRef.current = {
					clientX: event.clientX,
					clientY: event.clientY,
				};
				if (previewFramingMoveRafRef.current !== null) {
					return;
				}

				previewFramingMoveRafRef.current = requestAnimationFrame(() => {
					previewFramingMoveRafRef.current = null;
					applyPendingWebcamPreviewFraming();
				});
				return;
			}

			const dragState = webcamPreviewDragStartRef.current;
			if (!dragState || dragState.pointerId !== event.pointerId) {
				return;
			}

			const deltaX = event.clientX - dragState.startX;
			const deltaY = event.clientY - dragState.startY;

			if (!dragState.dragging && Math.hypot(deltaX, deltaY) < WEBCAM_PREVIEW_DRAG_THRESHOLD) {
				return;
			}

			if (!dragState.dragging) {
				dragState.dragging = true;
				isWebcamPreviewDraggingRef.current = true;
			}

			previewDragPendingPointerRef.current = {
				clientX: event.clientX,
				clientY: event.clientY,
			};
			if (previewDragMoveRafRef.current !== null) {
				return;
			}

			previewDragMoveRafRef.current = requestAnimationFrame(() => {
				previewDragMoveRafRef.current = null;
				const latestDragState = webcamPreviewDragStartRef.current;
				const pointer = previewDragPendingPointerRef.current;
				if (!latestDragState || !pointer) {
					return;
				}

				const latestDeltaX = pointer.clientX - latestDragState.startX;
				const latestDeltaY = pointer.clientY - latestDragState.startY;
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;
				const unclampedLeft = latestDragState.initialLeft + latestDeltaX;
				const unclampedTop = latestDragState.initialTop + latestDeltaY;
				const clampedLeft = Math.min(
					Math.max(0, unclampedLeft),
					Math.max(0, viewportWidth - latestDragState.previewWidth),
				);
				const clampedTop = Math.min(
					Math.max(0, unclampedTop),
					Math.max(0, viewportHeight - latestDragState.previewHeight),
				);

				const nextOffset = {
					x: latestDragState.originX + (clampedLeft - latestDragState.initialLeft),
					y: latestDragState.originY + (clampedTop - latestDragState.initialTop),
				};
				webcamPreviewOffsetRef.current = nextOffset;
				if (recordingWebcamPreviewContainerRef.current) {
					recordingWebcamPreviewContainerRef.current.style.transform = `translate(${nextOffset.x}px, ${nextOffset.y}px)`;
				}
			});
		},
		[applyPendingWebcamPreviewFraming],
	);

	const handleWebcamPreviewPointerUp = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const framingDrag = webcamFramingDragRef.current;
			if (framingDrag && framingDrag.pointerId === event.pointerId) {
				if (previewFramingMoveRafRef.current !== null) {
					cancelAnimationFrame(previewFramingMoveRafRef.current);
					previewFramingMoveRafRef.current = null;
				}
				applyPendingWebcamPreviewFraming();
				const result = previewFramingResultRef.current;
				if (result) {
					updateWebcamPreviewAppearance({
						centerX: result.centerX,
						centerY: result.centerY,
					});
				}

				webcamFramingDragRef.current = null;
				previewFramingPendingPointerRef.current = null;
				previewFramingResultRef.current = null;
				isWebcamPreviewDraggingRef.current = false;
				recordingWebcamPreviewContainerRef.current?.removeAttribute("data-framing");
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId);
				}
				releaseHudPassthrough();
				return;
			}

			const dragState = webcamPreviewDragStartRef.current;
			if (!dragState || dragState.pointerId !== event.pointerId) {
				return;
			}
			if (previewDragMoveRafRef.current !== null) {
				cancelAnimationFrame(previewDragMoveRafRef.current);
				previewDragMoveRafRef.current = null;
			}
			previewDragPendingPointerRef.current = null;

			webcamPreviewDragStartRef.current = null;
			isWebcamPreviewDraggingRef.current = false;
			setWebcamPreviewOffset({ ...webcamPreviewOffsetRef.current });
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			releaseHudPassthrough();
		},
		[applyPendingWebcamPreviewFraming, releaseHudPassthrough, updateWebcamPreviewAppearance],
	);

	const applyPendingWebcamPreviewResize = useCallback(() => {
		const resizeState = webcamPreviewResizeStartRef.current;
		const pointer = previewResizePendingPointerRef.current;
		if (!resizeState || !pointer) {
			return;
		}

		previewResizePendingPointerRef.current = null;
		const viewport = { width: window.innerWidth, height: window.innerHeight };
		const raw = computeResizedPreviewBox({
			corner: resizeState.corner,
			startSize: resizeState.startSize,
			startOffset: resizeState.startOffset,
			delta: {
				x: pointer.clientX - resizeState.startX,
				y: pointer.clientY - resizeState.startY,
			},
			centerScale: pointer.centerScale,
			quantize: pointer.quantize,
			snapSizes: WEBCAM_PREVIEW_SNAP_SIZES,
			viewport,
		});
		// Hard stop against available viewport width/height (including cases where
		// the normal min cannot fit, or the resize engine overshoots an edge).
		const constrained = resolveViewportConstrainedPreview({
			size: raw.size,
			placement: {
				offsetX: raw.offset.x,
				offsetY: raw.offset.y,
				visible: true,
			},
			viewport,
		});
		const result = {
			size: constrained.size,
			offset: {
				x: constrained.placement.offsetX,
				y: constrained.placement.offsetY,
			},
			snappedTo:
				raw.snappedTo !== null && constrained.size === raw.snappedTo ? raw.snappedTo : null,
		};
		previewResizeResultRef.current = result;

		const shell = recordingWebcamPreviewContainerRef.current;
		if (shell) {
			shell.style.width = `${result.size}px`;
			shell.style.height = `${result.size}px`;
			shell.style.transform = `translate(${result.offset.x}px, ${result.offset.y}px)`;
		}

		const appearance = webcamPreviewAppearanceRef.current;
		const layout = computeWebcamFramingLayout(
			{
				zoom: appearance.zoom,
				fitMode: "fill",
				centerX: appearance.centerX,
				centerY: appearance.centerY,
				mirror: appearance.mirror,
			},
			{ width: result.size, height: result.size },
			videoAspectRef.current,
		);
		const video = recordingWebcamPreviewVideoRef.current;
		if (video) {
			video.style.left = `${layout.video.left}px`;
			video.style.top = `${layout.video.top}px`;
			video.style.width = `${layout.video.width}px`;
			video.style.height = `${layout.video.height}px`;
		}

		const pill = webcamPreviewSizePillRef.current;
		if (pill) {
			pill.textContent = `${result.size} px`;
			pill.setAttribute("data-visible", "");
		}
	}, []);

	const handleWebcamResizeHandlePointerDown = useCallback(
		(corner: WebcamResizeCorner) => (event: PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			event.currentTarget.setPointerCapture(event.pointerId);
			holdHudPassthrough();
			webcamPreviewResizeStartRef.current = {
				corner,
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				startSize: webcamPreviewAppearanceRef.current.size,
				startOffset: { ...webcamPreviewOffsetRef.current },
			};
			previewResizePendingPointerRef.current = null;
			previewResizeResultRef.current = null;
			isWebcamPreviewResizingRef.current = true;
			recordingWebcamPreviewContainerRef.current?.setAttribute("data-resizing", "");
		},
		[holdHudPassthrough],
	);

	const handleWebcamResizeHandlePointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const resizeState = webcamPreviewResizeStartRef.current;
			if (!resizeState || resizeState.pointerId !== event.pointerId) {
				return;
			}

			previewResizePendingPointerRef.current = {
				clientX: event.clientX,
				clientY: event.clientY,
				centerScale: event.altKey,
				quantize: event.shiftKey,
			};
			if (previewResizeMoveRafRef.current !== null) {
				return;
			}

			previewResizeMoveRafRef.current = requestAnimationFrame(() => {
				previewResizeMoveRafRef.current = null;
				applyPendingWebcamPreviewResize();
			});
		},
		[applyPendingWebcamPreviewResize],
	);

	const handleWebcamResizeHandlePointerUp = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			const resizeState = webcamPreviewResizeStartRef.current;
			if (!resizeState || resizeState.pointerId !== event.pointerId) {
				return;
			}

			event.stopPropagation();
			if (previewResizeMoveRafRef.current !== null) {
				cancelAnimationFrame(previewResizeMoveRafRef.current);
				previewResizeMoveRafRef.current = null;
			}
			applyPendingWebcamPreviewResize();
			const result = previewResizeResultRef.current;
			if (result) {
				webcamPreviewOffsetRef.current = result.offset;
				setWebcamPreviewOffset(result.offset);
				if (result.size >= WEBCAM_PREVIEW_SIZE_RANGE.min) {
					updateWebcamPreviewAppearance({ size: result.size });
				} else {
					applyRuntimePreviewSize(result.size);
				}
			}

			webcamPreviewResizeStartRef.current = null;
			previewResizePendingPointerRef.current = null;
			previewResizeResultRef.current = null;
			isWebcamPreviewResizingRef.current = false;
			recordingWebcamPreviewContainerRef.current?.removeAttribute("data-resizing");
			webcamPreviewSizePillRef.current?.removeAttribute("data-visible");
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			releaseHudPassthrough();
		},
		[
			applyPendingWebcamPreviewResize,
			applyRuntimePreviewSize,
			releaseHudPassthrough,
			updateWebcamPreviewAppearance,
		],
	);

	const handleWebcamResizeHandleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>, corner: WebcamResizeCorner) => {
			const viewport = { width: window.innerWidth, height: window.innerHeight };
			const raw = computeKeyboardResizedPreviewBox({
				corner,
				key: event.key,
				startSize: webcamPreviewAppearanceRef.current.size,
				startOffset: webcamPreviewOffsetRef.current,
				coarse: event.shiftKey,
				centerScale: event.altKey,
				snapSizes: WEBCAM_PREVIEW_SNAP_SIZES,
				viewport,
			});
			if (!raw) return;

			event.preventDefault();
			event.stopPropagation();
			const constrained = resolveViewportConstrainedPreview({
				size: raw.size,
				placement: {
					offsetX: raw.offset.x,
					offsetY: raw.offset.y,
					visible: true,
				},
				viewport,
			});
			const nextOffset = {
				x: constrained.placement.offsetX,
				y: constrained.placement.offsetY,
			};
			webcamPreviewOffsetRef.current = nextOffset;
			setWebcamPreviewOffset(nextOffset);
			updateWebcamPreviewAppearance({ size: constrained.size });

			const pill = webcamPreviewSizePillRef.current;
			if (pill) {
				pill.textContent = `${constrained.size} px`;
				pill.setAttribute("data-visible", "");
				if (keyboardResizePillTimerRef.current !== null) {
					clearTimeout(keyboardResizePillTimerRef.current);
				}
				keyboardResizePillTimerRef.current = setTimeout(() => {
					keyboardResizePillTimerRef.current = null;
					pill.removeAttribute("data-visible");
				}, 700);
			}
		},
		[updateWebcamPreviewAppearance],
	);

	useEffect(() => {
		return () => {
			if (keyboardResizePillTimerRef.current !== null) {
				clearTimeout(keyboardResizePillTimerRef.current);
			}
		};
	}, []);

	const syncVideoAspectFromNode = useCallback((videoElement: HTMLVideoElement) => {
		const { videoWidth, videoHeight } = videoElement;
		if (videoWidth <= 0 || videoHeight <= 0) {
			return;
		}
		const nextAspect = videoWidth / videoHeight;
		setVideoAspect((current) => (current === nextAspect ? current : nextAspect));
	}, []);

	const detachVideoAspectListener = useCallback((videoElement: HTMLVideoElement) => {
		const listener = metadataListenerByNodeRef.current.get(videoElement);
		if (!listener) {
			return;
		}
		videoElement.removeEventListener("loadedmetadata", listener);
		metadataListenerByNodeRef.current.delete(videoElement);
	}, []);

	const attachVideoAspectListener = useCallback(
		(videoElement: HTMLVideoElement) => {
			if (metadataListenerByNodeRef.current.has(videoElement)) {
				syncVideoAspectFromNode(videoElement);
				return;
			}
			const onLoadedMetadata = () => {
				syncVideoAspectFromNode(videoElement);
			};
			videoElement.addEventListener("loadedmetadata", onLoadedMetadata);
			metadataListenerByNodeRef.current.set(videoElement, onLoadedMetadata);
			syncVideoAspectFromNode(videoElement);
		},
		[syncVideoAspectFromNode],
	);

	const attachPreviewStreamToNode = useCallback(
		(videoElement: HTMLVideoElement | null) => {
			const previewStream = previewStreamRef.current;
			if (!videoElement || !previewStream || videoElement.srcObject === previewStream) {
				return;
			}

			videoElement.srcObject = previewStream;
			attachVideoAspectListener(videoElement);
			const playPromise = videoElement.play();
			if (playPromise) {
				playPromise.catch(() => {
					// Ignore autoplay interruptions while the preview element mounts.
				});
			}
		},
		[attachVideoAspectListener],
	);

	type PreviewVideoSlot =
		| "popoverFrame"
		| "popoverBackdrop"
		| "floatingFrame"
		| "floatingBackdrop";

	const previewVideoSlotsRef = useRef<Record<PreviewVideoSlot, HTMLVideoElement | null>>({
		popoverFrame: null,
		popoverBackdrop: null,
		floatingFrame: null,
		floatingBackdrop: null,
	});

	const registerPreviewVideoNode = useCallback(
		(slot: PreviewVideoSlot, node: HTMLVideoElement | null) => {
			const previous = previewVideoSlotsRef.current[slot];
			if (previous && previous !== node) {
				previewVideoNodesRef.current.delete(previous);
				detachVideoAspectListener(previous);
				previous.pause();
				previous.srcObject = null;
			}
			previewVideoSlotsRef.current[slot] = node;
			if (node) {
				previewVideoNodesRef.current.add(node);
				attachVideoAspectListener(node);
				attachPreviewStreamToNode(node);
			}
		},
		[attachPreviewStreamToNode, attachVideoAspectListener, detachVideoAspectListener],
	);

	const setWebcamPreviewNode = useCallback(
		(node: HTMLVideoElement | null) => {
			registerPreviewVideoNode("popoverFrame", node);
		},
		[registerPreviewVideoNode],
	);

	const setWebcamPreviewBackdropNode = useCallback(
		(node: HTMLVideoElement | null) => {
			registerPreviewVideoNode("popoverBackdrop", node);
		},
		[registerPreviewVideoNode],
	);

	const setRecordingWebcamPreviewNode = useCallback(
		(node: HTMLVideoElement | null) => {
			recordingWebcamPreviewVideoRef.current = node;
			registerPreviewVideoNode("floatingFrame", node);
		},
		[registerPreviewVideoNode],
	);

	const setRecordingWebcamPreviewBackdropNode = useCallback(
		(node: HTMLVideoElement | null) => {
			registerPreviewVideoNode("floatingBackdrop", node);
		},
		[registerPreviewVideoNode],
	);

	useEffect(() => {
		return () => {
			if (previewDragMoveRafRef.current !== null) {
				cancelAnimationFrame(previewDragMoveRafRef.current);
			}
			previewDragMoveRafRef.current = null;
			previewDragPendingPointerRef.current = null;
			if (previewFramingMoveRafRef.current !== null) {
				cancelAnimationFrame(previewFramingMoveRafRef.current);
			}
			previewFramingMoveRafRef.current = null;
			previewFramingPendingPointerRef.current = null;
			previewFramingResultRef.current = null;
			webcamFramingDragRef.current = null;
			recordingWebcamPreviewContainerRef.current?.removeAttribute("data-framing");
			if (previewResizeMoveRafRef.current !== null) {
				cancelAnimationFrame(previewResizeMoveRafRef.current);
			}
			previewResizeMoveRafRef.current = null;
			previewResizePendingPointerRef.current = null;
			previewResizeResultRef.current = null;
		};
	}, []);

	useEffect(() => {
		// Re-run when the committed preview size changes (resize end / viewport fit).
		const preferredSize = Number.isFinite(preferredWebcamPreviewSizeRef.current)
			? preferredWebcamPreviewSizeRef.current
			: webcamPreviewAppearance.size;
		const timeoutId = window.setTimeout(() => {
			const preview = recordingWebcamPreviewContainerRef.current;
			if (!preview || isWebcamPreviewResizingRef.current) return;

			const viewport = { width: window.innerWidth, height: window.innerHeight };
			const safeSize = clampWebcamPreviewSizeToViewport(preferredSize, viewport);
			if (safeSize !== webcamPreviewAppearanceRef.current.size) {
				applyRuntimePreviewSize(safeSize);
				preview.style.width = `${safeSize}px`;
				preview.style.height = `${safeSize}px`;
			}

			const rect = preview.getBoundingClientRect();
			const clampedLeft = Math.min(
				Math.max(0, rect.left),
				Math.max(0, viewport.width - safeSize),
			);
			const clampedTop = Math.min(
				Math.max(0, rect.top),
				Math.max(0, viewport.height - safeSize),
			);
			const correctionX = clampedLeft - rect.left;
			const correctionY = clampedTop - rect.top;
			if (Math.abs(correctionX) < 0.5 && Math.abs(correctionY) < 0.5) return;

			const nextOffset = {
				x: webcamPreviewOffsetRef.current.x + correctionX,
				y: webcamPreviewOffsetRef.current.y + correctionY,
			};
			webcamPreviewOffsetRef.current = nextOffset;
			preview.style.transform = `translate(${nextOffset.x}px, ${nextOffset.y}px)`;
			setWebcamPreviewOffset(nextOffset);
		}, 200);

		return () => window.clearTimeout(timeoutId);
	}, [applyRuntimePreviewSize, webcamPreviewAppearance.size]);

	useEffect(() => {
		let mounted = true;

		const notifyUnavailable = () => {
			if (previewUnavailableNotifiedRef.current) {
				return;
			}
			previewUnavailableNotifiedRef.current = true;
			onWebcamPreviewUnavailableRef.current?.();
		};

		const startPreview = async () => {
			if (!shouldStreamWebcamPreview) {
				return;
			}

			try {
				let previewStream: MediaStream;
				try {
					previewStream = await navigator.mediaDevices.getUserMedia({
						video: buildPreviewVideoConstraints(webcamDeviceId),
						audio: false,
					});
				} catch (error) {
					// Preview resilience: one retry without exact device on missing/overconstrained cam.
					if (webcamDeviceId && isDeviceConstraintError(error)) {
						try {
							previewStream = await navigator.mediaDevices.getUserMedia({
								video: buildPreviewVideoConstraints(),
								audio: false,
							});
						} catch (retryError) {
							console.warn("Failed to start live webcam preview:", retryError);
							notifyUnavailable();
							return;
						}
					} else if (isNotAllowedError(error)) {
						console.warn("Failed to start live webcam preview:", error);
						notifyUnavailable();
						return;
					} else {
						console.warn("Failed to start live webcam preview:", error);
						notifyUnavailable();
						return;
					}
				}

				if (!mounted) {
					previewStream.getTracks().forEach((track) => track.stop());
					return;
				}

				previewStreamRef.current = previewStream;
				// Track settings are the authoritative aspect for the freshly negotiated
				// stream; element metadata can lag a device switch and distort the layout.
				const trackSettings = previewStream.getVideoTracks()[0]?.getSettings();
				if (
					trackSettings &&
					typeof trackSettings.width === "number" &&
					typeof trackSettings.height === "number" &&
					trackSettings.width > 0 &&
					trackSettings.height > 0
				) {
					const nextAspect = trackSettings.width / trackSettings.height;
					setVideoAspect((current) => (current === nextAspect ? current : nextAspect));
				}
				for (const node of previewVideoNodesRef.current) {
					attachPreviewStreamToNode(node);
				}
			} catch (error) {
				console.warn("Failed to start live webcam preview:", error);
				notifyUnavailable();
			}
		};

		void startPreview();

		return () => {
			mounted = false;
			const previewStream = previewStreamRef.current;

			for (const videoElement of previewVideoNodesRef.current) {
				videoElement.pause();
				videoElement.srcObject = null;
			}
			previewStream?.getTracks().forEach((track) => track.stop());
			if (previewStreamRef.current === previewStream) {
				previewStreamRef.current = null;
			}
		};
	}, [attachPreviewStreamToNode, shouldStreamWebcamPreview, webcamDeviceId]);

	useEffect(() => {
		return () => {
			for (const videoElement of previewVideoNodesRef.current) {
				detachVideoAspectListener(videoElement);
			}
			previewVideoNodesRef.current.clear();
			metadataListenerByNodeRef.current.clear();
		};
	}, [detachVideoAspectListener]);

	return {
		showFloatingWebcamPreview,
		setShowFloatingWebcamPreview,
		webcamPreviewAppearance,
		updateWebcamPreviewAppearance,
		webcamPreviewOffset,
		videoAspect,
		recordingWebcamPreviewContainerRef,
		isWebcamPreviewDraggingRef,
		isWebcamPreviewResizingRef,
		webcamPreviewDragStartRef,
		webcamPreviewSizePillRef,
		handleWebcamPreviewPointerDown,
		handleWebcamPreviewPointerMove,
		handleWebcamPreviewPointerUp,
		handleWebcamResizeHandlePointerDown,
		handleWebcamResizeHandlePointerMove,
		handleWebcamResizeHandlePointerUp,
		handleWebcamResizeHandleKeyDown,
		setWebcamPreviewNode,
		setWebcamPreviewBackdropNode,
		setRecordingWebcamPreviewNode,
		setRecordingWebcamPreviewBackdropNode,
		showRecordingWebcamPreview,
	};
}
