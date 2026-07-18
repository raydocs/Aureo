import {
	Camera,
	EyeSlash,
	FilmSlate as Film,
	Gauge,
	Selection as MaskIcon,
	ChatCircle as MessageSquare,
	MusicNotes as Music,
	MouseLeftClickIcon as PhMouseLeftClick,
	Scissors,
	SpeakerX,
	MagnifyingGlassPlus as ZoomIn,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import { useItem } from "dnd-timeline";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatClipSpeedLabel } from "../clipSpeedChange";
import type { ZoomMode } from "../types";
import AudioWaveform from "./components/waveform/AudioWaveform";
import type { AudioPeaksData } from "./core/timelineTypes";
import glassStyles from "./ItemGlass.module.css";

interface ItemProps {
	id: string;
	span: Span;
	rowId: string;
	disabled?: boolean;
	children: React.ReactNode;
	isSelected?: boolean;
	onSelect?: () => void;
	onSelectId?: (id: string) => void;
	zoomDepth?: number;
	zoomMode?: ZoomMode;
	speedValue?: number;
	waveformPeaks?: AudioPeaksData | null;
	waveformSegmentSpan?: Span;
	waveformGain?: number;
	waveformNormalize?: boolean;
	muted?: boolean;
	hideCursor?: boolean;
	disableCursorSmoothing?: boolean;
	maskType?: "blur" | "highlight";
	maskOpacity?: number;
	maskDisabled?: boolean;
	variant?:
		| "zoom"
		| "trim"
		| "clip"
		| "annotation"
		| "mask"
		| "speed"
		| "audio"
		| "caption"
		| "webcam-layout";
	webcamLayoutMode?: "default" | "fullscreen" | "hidden";
	isLoading?: boolean;
	loadingLabel?: string;
}

// Map zoom depth to multiplier labels
const ZOOM_LABELS: Record<number, string> = {
	1: "1.25×",
	2: "1.5×",
	3: "1.8×",
	4: "2.2×",
	5: "3.5×",
	6: "5×",
};

function formatMs(ms: number): string {
	const totalSeconds = ms / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
	}
	return `${seconds.toFixed(1)}s`;
}

export default function Item({
	id,
	span,
	rowId,
	disabled = false,
	isSelected = false,
	onSelect,
	onSelectId,
	zoomDepth = 1,
	zoomMode = "auto",
	speedValue,
	waveformPeaks = null,
	waveformSegmentSpan,
	waveformGain = 1,
	waveformNormalize = false,
	muted = false,
	hideCursor = false,
	disableCursorSmoothing = false,
	maskType = "blur",
	maskOpacity = 0.54,
	maskDisabled = false,
	variant = "zoom",
	webcamLayoutMode = "fullscreen",
	isLoading = false,
	loadingLabel,
	children,
}: ItemProps) {
	const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
		id,
		span,
		disabled: disabled || isLoading,
		data: { rowId },
	});

	const timeLabel = useMemo(
		() => `${formatMs(span.start)} – ${formatMs(span.end)}`,
		[span.start, span.end],
	);

	if (isLoading) {
		return (
			<div
				ref={setNodeRef}
				style={{
					...itemStyle,
					height: "100%",
					display: "flex",
					alignItems: "center",
				}}
				{...listeners}
				{...attributes}
				data-timeline-item="true"
				onMouseDownCapture={(event) => event.stopPropagation()}
				onClickCapture={(event) => event.stopPropagation()}
			>
				<Skeleton
					variant="clip"
					animation="shimmer-premium"
					label={loadingLabel || "Loading..."}
					className="w-full"
					style={{ height: "85%", minHeight: 22 }}
				/>
			</div>
		);
	}

	const isZoom = variant === "zoom";
	const isTrim = variant === "trim";
	const isClip = variant === "clip";
	const isSpeed = variant === "speed";
	const isMask = variant === "mask";
	const isAudio = variant === "audio";
	const isCaption = variant === "caption";
	const isWebcamLayout = variant === "webcam-layout";
	const showAudioWaveform = isAudio && Boolean(waveformPeaks);
	const clipSpeedLabel = isClip ? formatClipSpeedLabel(speedValue ?? 1) : null;

	const glassClass = isZoom
		? glassStyles.glassPurple
		: isTrim
			? glassStyles.glassRed
			: isClip
				? glassStyles.glassCyan
				: isSpeed
					? glassStyles.glassAmber
					: isMask
						? glassStyles.glassMask
						: isAudio
							? glassStyles.glassDarkGreen
							: isCaption
								? glassStyles.glassCaption
								: isWebcamLayout
									? glassStyles.glassGreen
									: glassStyles.glassYellow;

	const MIN_ITEM_PX = 6;
	const handleSelect = () => {
		onSelect?.();
		onSelectId?.(id);
	};
	const safeItemStyle = {
		...itemStyle,
		minWidth: MIN_ITEM_PX,
		height: "100%",
		overflow: "hidden",
	};

	return (
		<div
			ref={setNodeRef}
			style={safeItemStyle}
			{...listeners}
			{...attributes}
			data-timeline-item="true"
			onPointerDownCapture={handleSelect}
			className="group h-full"
		>
			<div
				className="h-full"
				style={{
					...itemContentStyle,
					minWidth: MIN_ITEM_PX,
					height: "100%",
					display: "flex",
					alignItems: "center",
				}}
			>
				<div
					className={cn(
						glassClass,
						"w-full overflow-hidden flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing relative",
						isSelected && glassStyles.selected,
						disabled && glassStyles.disabled,
						isAudio && muted && glassStyles.muted,
					)}
					style={{
						height: "85%",
						minHeight: 22,
						minWidth: MIN_ITEM_PX,
					}}
					onClick={(event) => {
						event.stopPropagation();
					}}
				>
					<div
						className={cn(glassStyles.zoomEndCap, glassStyles.left)}
						style={{ cursor: "col-resize", pointerEvents: "auto" }}
						title="Resize left"
					/>
					<div
						className={cn(glassStyles.zoomEndCap, glassStyles.right)}
						style={{ cursor: "col-resize", pointerEvents: "auto" }}
						title="Resize right"
					/>
					{showAudioWaveform && waveformPeaks && (
						<AudioWaveform
							peaks={waveformPeaks}
							segmentStartMs={waveformSegmentSpan?.start ?? span.start}
							segmentEndMs={waveformSegmentSpan?.end ?? span.end}
							gain={waveformGain}
							normalize={waveformNormalize}
							className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
						/>
					)}
					{/* Muted overlay for source audio track items */}
					{isAudio && muted && (
						<div className="absolute inset-0 z-20 flex items-center justify-center gap-1 bg-red-900/40 pointer-events-none">
							<SpeakerX className="w-3 h-3 text-red-300/90 shrink-0" />
						</div>
					)}
					{/* Content */}
					<div className="relative z-10 flex flex-col items-center justify-center text-black/70 dark:text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none overflow-hidden">
						<div className="flex items-center gap-1.5">
							{isZoom ? (
								<>
									<ZoomIn className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{ZOOM_LABELS[zoomDepth] || `${zoomDepth}×`}
									</span>
								</>
							) : isTrim ? (
								<>
									<Scissors className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										Trim
									</span>
								</>
							) : isClip ? (
								<>
									<Film className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										Clip
									</span>
									{clipSpeedLabel && (
										<span className="rounded-[4px] bg-black/10 px-1 text-[9px] font-bold tabular-nums text-black/65 dark:bg-white/15 dark:text-white/80">
											{clipSpeedLabel}
										</span>
									)}
									{hideCursor && (
										<span
											className="inline-flex h-4 items-center rounded-[4px] bg-black/10 px-1 text-black/65 dark:bg-white/15 dark:text-white/80"
											title="Mouse cursor hidden in this clip"
										>
											<EyeSlash className="h-2.5 w-2.5" />
										</span>
									)}
									{disableCursorSmoothing && (
										<span
											className="rounded-[4px] bg-black/10 px-1 text-[8px] font-bold uppercase text-black/65 dark:bg-white/15 dark:text-white/80"
											title="Smooth mouse movement disabled in this clip"
										>
											Raw
										</span>
									)}
								</>
							) : isSpeed ? (
								<>
									<Gauge className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{speedValue !== undefined ? `${speedValue}×` : "Speed"}
									</span>
								</>
							) : isMask ? (
								<>
									<MaskIcon className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{maskType === "highlight"
											? `Highlight ${Math.round(maskOpacity * 100)}%`
											: "Sensitive Data"}
									</span>
									{maskDisabled && (
										<span className="rounded-[4px] bg-black/15 px-1 text-[8px] font-bold uppercase">
											Off
										</span>
									)}
								</>
							) : isAudio ? (
								<>
									<Music className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight truncate max-w-full">
										{children}
									</span>
								</>
							) : isWebcamLayout ? (
								<>
									{webcamLayoutMode === "hidden" ? (
										<EyeSlash className="w-3.5 h-3.5 shrink-0" />
									) : (
										<Camera className="w-3.5 h-3.5 shrink-0" />
									)}
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{children}
									</span>
								</>
							) : (
								<>
									<MessageSquare className="w-3.5 h-3.5 shrink-0" />
									<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
										{children}
									</span>
								</>
							)}
						</div>
						{isZoom ? (
							<div
								className={`flex items-center gap-0.5 transition-opacity ${isSelected ? "opacity-70" : "opacity-0 group-hover:opacity-50"}`}
							>
								<PhMouseLeftClick
									className="w-2.5 h-2.5 shrink-0"
									weight={zoomMode === "auto" ? "fill" : "regular"}
								/>
								<span className="text-[9px] font-medium tracking-tight whitespace-nowrap">
									{zoomMode === "manual"
										? "Manual"
										: zoomMode === "instant"
											? "Instant"
											: "Auto"}
								</span>
							</div>
						) : (
							<span
								className={`text-[9px] tabular-nums tracking-tight whitespace-nowrap transition-opacity ${
									isSelected ? "opacity-60" : "opacity-0 group-hover:opacity-40"
								}`}
							>
								{timeLabel}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
