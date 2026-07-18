import { type MouseEvent, type RefObject, useCallback, useEffect, useRef } from "react";
import { isHudInteractiveTarget } from "../hudMousePassthrough";

export function useLaunchHudInteractionState({
	openId,
	isHudDraggingRef,
	isWebcamPreviewDraggingRef,
	isWebcamPreviewResizingRef,
	webcamPreviewDragStartRef,
}: {
	openId: string | null;
	isHudDraggingRef: RefObject<boolean>;
	isWebcamPreviewDraggingRef: RefObject<boolean>;
	isWebcamPreviewResizingRef: RefObject<boolean>;
	webcamPreviewDragStartRef: RefObject<unknown>;
}) {
	const isMouseOverHudRef = useRef(false);
	const openIdRef = useRef(openId);
	const ignoreMouseRef = useRef<boolean | null>(null);

	openIdRef.current = openId;

	const setIgnoreMouse = useCallback((ignore: boolean) => {
		if (ignoreMouseRef.current === ignore) {
			return;
		}
		ignoreMouseRef.current = ignore;
		window.electronAPI?.hudOverlaySetIgnoreMouse?.(ignore);
	}, []);

	const canRestorePassthrough = useCallback(() => {
		return (
			openIdRef.current === null &&
			!isHudDraggingRef.current &&
			!isWebcamPreviewDraggingRef.current &&
			!isWebcamPreviewResizingRef.current &&
			!webcamPreviewDragStartRef.current &&
			!isMouseOverHudRef.current
		);
	}, [
		isHudDraggingRef,
		isWebcamPreviewDraggingRef,
		isWebcamPreviewResizingRef,
		webcamPreviewDragStartRef,
	]);

	// Initial mount: proactively request click-through until the pointer hits HUD chrome.
	useEffect(() => {
		setIgnoreMouse(true);
	}, [setIgnoreMouse]);

	useEffect(() => {
		if (openId !== null) {
			setIgnoreMouse(false);
			return;
		}

		if (canRestorePassthrough()) {
			setIgnoreMouse(true);
		}
	}, [openId, canRestorePassthrough, setIgnoreMouse]);

	useEffect(() => {
		const handleMouseMove = (event: globalThis.MouseEvent) => {
			const targetAtPointer = document.elementFromPoint(event.clientX, event.clientY);
			const isInteractive = isHudInteractiveTarget(targetAtPointer ?? event.target);

			if (isInteractive) {
				isMouseOverHudRef.current = true;
				setIgnoreMouse(false);
				return;
			}

			isMouseOverHudRef.current = false;

			if (!canRestorePassthrough()) {
				return;
			}

			setIgnoreMouse(true);
		};

		window.addEventListener("mousemove", handleMouseMove);
		return () => window.removeEventListener("mousemove", handleMouseMove);
	}, [canRestorePassthrough, setIgnoreMouse]);

	const beginInteractiveHudAction = useCallback(() => {
		isMouseOverHudRef.current = true;
		setIgnoreMouse(false);
	}, [setIgnoreMouse]);

	const handleHudMouseEnter = useCallback(() => {
		isMouseOverHudRef.current = true;
		setIgnoreMouse(false);
	}, [setIgnoreMouse]);

	const handleHudMouseLeave = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			const nextTarget = event.relatedTarget;
			if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
				return;
			}

			isMouseOverHudRef.current = false;

			if (
				openId === null &&
				!isHudDraggingRef.current &&
				!isWebcamPreviewDraggingRef.current &&
				!isWebcamPreviewResizingRef.current &&
				!webcamPreviewDragStartRef.current
			) {
				setIgnoreMouse(true);
			}
		},
		[
			openId,
			isHudDraggingRef,
			isWebcamPreviewDraggingRef,
			isWebcamPreviewResizingRef,
			webcamPreviewDragStartRef,
			setIgnoreMouse,
		],
	);

	return {
		handleHudMouseEnter,
		handleHudMouseLeave,
		beginInteractiveHudAction,
	};
}
