import { useCallback, useEffect, useState } from "react";

export function CountdownView({
	countdown,
	onCancel,
}: {
	countdown: number;
	onCancel: () => void;
}) {
	const unit = countdown === 1 ? "second" : "seconds";

	return (
		<div className="fixed inset-0 flex items-center justify-center select-none">
			<div
				role="status"
				aria-live="assertive"
				aria-atomic="true"
				className="flex flex-col items-center justify-center gap-1 rounded-3xl"
				style={{
					width: 180,
					height: 180,
					background: "rgba(0, 0, 0, 0.85)",
					backdropFilter: "blur(20px)",
				}}
			>
				<span className="sr-only">{`Recording starts in ${countdown} ${unit}`}</span>
				<span
					aria-hidden="true"
					className="text-white font-bold tabular-nums"
					style={{
						fontSize: "88px",
						lineHeight: 1,
						textShadow: "0 0 30px rgba(255,255,255,0.2)",
					}}
				>
					{countdown}
				</span>
				<button
					type="button"
					autoFocus
					aria-label="Cancel countdown"
					onClick={onCancel}
					className="rounded-full px-3 py-1 text-xs font-semibold text-white/80 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

export function CountdownOverlay() {
	const [countdown, setCountdown] = useState<number | null>(null);

	useEffect(() => {
		void window.electronAPI.getActiveCountdown().then((result) => {
			if (result.success && typeof result.seconds === "number") {
				setCountdown(result.seconds);
			}
		});

		const cleanup = window.electronAPI.onCountdownTick((seconds: number) => {
			setCountdown(seconds);
		});

		return cleanup;
	}, []);

	const handleCancel = useCallback(() => {
		window.electronAPI.cancelCountdown();
	}, []);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape") {
				handleCancel();
			}
		},
		[handleCancel],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	if (countdown === null) {
		return null;
	}

	return <CountdownView countdown={countdown} onCancel={handleCancel} />;
}
