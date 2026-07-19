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
	const [keyboardRect, setKeyboardRect] = useState<LocalRect>(() => {
		const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
		const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
		return {
			x: Math.round(viewportWidth * 0.1),
			y: Math.round(viewportHeight * 0.1),
			width: Math.max(64, Math.round(viewportWidth * 0.8)),
			height: Math.max(64, Math.round(viewportHeight * 0.8)),
		};
	});
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
	const updateKeyboardRect = (key: keyof LocalRect, value: string) => {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			const minimum = key === "width" || key === "height" ? 16 : 0;
			setKeyboardRect((current) => ({ ...current, [key]: Math.max(minimum, parsed) }));
		}
	};

	return (
		<div
			className="area-selector-root"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
		>
			<div className="area-selector-scrim" />
			<details
				className="area-selector-keyboard"
				onPointerDown={(event) => event.stopPropagation()}
			>
				<summary>Choose area with keyboard</summary>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						setDraftRect(keyboardRect);
						void completeSelection(keyboardRect);
					}}
				>
					{(["x", "y", "width", "height"] as const).map((key) => (
						<label key={key}>
							<span>{key === "x" ? "Left" : key === "y" ? "Top" : key}</span>
							<input
								type="number"
								min={key === "width" || key === "height" ? 16 : 0}
								step={1}
								value={Math.round(keyboardRect[key])}
								aria-label={`Selection ${key === "x" ? "left" : key === "y" ? "top" : key}`}
								onChange={(event) =>
									updateKeyboardRect(key, event.currentTarget.value)
								}
							/>
						</label>
					))}
					<div className="area-selector-keyboard-actions">
						<button type="submit" disabled={submitting}>
							Use selection
						</button>
						<button
							type="button"
							disabled={submitting}
							onClick={() => void cancelSelection()}
						>
							Cancel
						</button>
					</div>
				</form>
			</details>
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
			<div className="area-selector-hint" role="status" aria-live="polite">
				{hint}
			</div>
		</div>
	);
}
