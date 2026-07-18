import {
	SpeakerLow as Volume1,
	SpeakerHigh as Volume2,
	SpeakerX as VolumeX,
} from "@phosphor-icons/react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PreviewVolumeControlProps {
	value: number;
	onChange: (value: number) => void;
	volumeLabel: string;
	muteLabel: string;
	unmuteLabel: string;
	className?: string;
}

export function PreviewVolumeControl({
	value,
	onChange,
	volumeLabel,
	muteLabel,
	unmuteLabel,
	className,
}: PreviewVolumeControlProps) {
	const normalizedValue = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
	const percent = Math.round(normalizedValue * 100);
	const isMuted = normalizedValue <= 0.001;
	const previousAudibleValue = useRef(normalizedValue > 0.001 ? normalizedValue : 1);
	if (!isMuted) {
		previousAudibleValue.current = normalizedValue;
	}

	return (
		<div className={cn("flex items-center gap-1", className)}>
			<Button
				type="button"
				variant="toolbar"
				size="icon-sm"
				iconSize="sm"
				onClick={() => onChange(isMuted ? previousAudibleValue.current : 0)}
				aria-label={isMuted ? unmuteLabel : muteLabel}
				aria-pressed={isMuted}
				title={isMuted ? unmuteLabel : muteLabel}
			>
				{isMuted ? <VolumeX /> : normalizedValue < 0.5 ? <Volume1 /> : <Volume2 />}
			</Button>
			<div className="relative flex h-7 w-24 items-center overflow-hidden rounded-control-sm border border-hairline bg-surface-panel shadow-aureo-1 focus-within:ring-2 focus-within:ring-ring">
				<div
					aria-hidden="true"
					className="absolute inset-y-[3px] left-[3px] rounded-[4px] bg-surface-foreground/10"
					style={{
						width:
							normalizedValue > 0
								? `max(calc(${normalizedValue * 100}% - 6px), 1.2rem)`
								: 0,
					}}
				/>
				<span className="pointer-events-none relative z-10 pl-2 text-[10px] font-medium tabular-nums text-surface-foreground-muted">
					{percent}%
				</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={normalizedValue}
					onChange={(event) => onChange(Number(event.target.value))}
					aria-label={volumeLabel}
					aria-valuetext={`${percent}%`}
					className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
				/>
			</div>
		</div>
	);
}
