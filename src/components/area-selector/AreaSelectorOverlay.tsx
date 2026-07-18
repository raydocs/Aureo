import { useCallback, useEffect, useRef, useState } from "react";

type LocalRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

function normalizeLocalRect(startX: number, startY: number, endX: number, endY: number): LocalRect {
	return {
		x: Math.min(startX, endX),
		y: Math.min(startY, endY),
		width: Math.abs(endX - startX),
		height: Math.abs(endY - startY),
	};
}

/**
 * Transparent full-desktop area selection overlay.
 * Coordinates are window-local DIP; main process maps them to global desktop DIP.
 */
export function AreaSelectorOverlay() {
	const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
	const [draftRect, setDraftRect] = useState<LocalRect | null>(null);
	const [hint, setHint] = useState("Drag to select an area · Esc to cancel");
	const [submitting, setSubmitting] = useState(false);
	const activePointerId = useRef<number | null>(null);

	const resetDraft = useCallback(() => {
		setDragStart(null);
		setDraftRect(null);
		activePointerId.current = null;
		setHint("Drag to select an area · Esc to cancel");
	}, []);

	const cancelSelection = useCallback(async () => {
		if (submitting) {
			return;
		}
		setSubmitting(true);
		try {
			await window.electronAPI.cancelAreaSelection?.();
		} catch (error) {
			console.error("Failed to cancel area selection:", error);
			setSubmitting(false);
			resetDraft();
		}
	}, [resetDraft, submitting]);

	const completeSelection = useCallback(
		async (localRect: LocalRect) => {
			if (submitting) {
				return;
			}
			setSubmitting(true);
			setHint("Confirming selection…");
			try {
				const result = await window.electronAPI.completeAreaSelection?.(localRect);
				if (result && "error" in result && result.error && !result.source) {
					// Keep overlay open for reselect (too small / off desktop).
					setSubmitting(false);
					setHint(result.error);
					setDraftRect(null);
					setDragStart(null);
					activePointerId.current = null;
					return;
				}
				// Success or cancel closes the window from main.
			} catch (error) {
				console.error("Failed to complete area selection:", error);
				setSubmitting(false);
				setHint("Could not confirm selection. Try again or press Esc.");
				setDraftRect(null);
				setDragStart(null);
				activePointerId.current = null;
			}
		},
		[submitting],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				void cancelSelection();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [cancelSelection]);

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (submitting || event.button !== 0) {
			return;
		}
		event.currentTarget.setPointerCapture(event.pointerId);
		activePointerId.current = event.pointerId;
		const start = { x: event.clientX, y: event.clientY };
		setDragStart(start);
		setDraftRect({ x: start.x, y: start.y, width: 0, height: 0 });
		setHint("Release to confirm · Esc to cancel");
	};

	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (submitting || !dragStart || activePointerId.current !== event.pointerId) {
			return;
		}
		setDraftRect(normalizeLocalRect(dragStart.x, dragStart.y, event.clientX, event.clientY));
	};

	const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		if (submitting || !dragStart || activePointerId.current !== event.pointerId) {
			return;
		}
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// ignore
		}
		const rect = normalizeLocalRect(dragStart.x, dragStart.y, event.clientX, event.clientY);
		setDraftRect(rect);
		activePointerId.current = null;
		setDragStart(null);
		void completeSelection(rect);
	};

	const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
		if (activePointerId.current === event.pointerId) {
			resetDraft();
		}
	};

	const sizeLabel =
		draftRect && draftRect.width > 0 && draftRect.height > 0
			? `${Math.round(draftRect.width)} × ${Math.round(draftRect.height)}`
			: null;

	return (
		<div
			className="area-selector-root"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
		>
			<div className="area-selector-scrim" />
			{draftRect && draftRect.width > 0 && draftRect.height > 0 ? (
				<div
					className="area-selector-rect"
					style={{
						left: draftRect.x,
						top: draftRect.y,
						width: draftRect.width,
						height: draftRect.height,
					}}
				>
					{sizeLabel ? <div className="area-selector-size">{sizeLabel}</div> : null}
				</div>
			) : null}
			<div className="area-selector-hint">{hint}</div>
		</div>
	);
}
