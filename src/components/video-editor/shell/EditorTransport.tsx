import {
	MagnifyingGlassPlus,
	Pause,
	Play,
	Scissors,
	SkipBack,
	SkipForward,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { FloatingToolbar } from "@/components/ui/floating-toolbar";
import { cn } from "@/lib/utils";

interface EditorTransportProps {
	ariaLabel: string;
	currentTimeLabel: string;
	durationLabel: string;
	isPlaying: boolean;
	playLabel: string;
	pauseLabel: string;
	skipBackLabel: string;
	skipForwardLabel: string;
	splitClipLabel: string;
	zoomToPlayheadLabel: string;
	onSkipBack: () => void;
	onTogglePlayPause: () => void;
	onSkipForward: () => void;
	onSplitClip: () => void;
	onZoomToPlayhead: () => void;
	canSplit?: boolean;
	canZoomToPlayhead?: boolean;
	className?: string;
}

export function EditorTransport({
	ariaLabel,
	currentTimeLabel,
	durationLabel,
	isPlaying,
	playLabel,
	pauseLabel,
	skipBackLabel,
	skipForwardLabel,
	splitClipLabel,
	zoomToPlayheadLabel,
	onSkipBack,
	onTogglePlayPause,
	onSkipForward,
	onSplitClip,
	onZoomToPlayhead,
	canSplit = true,
	canZoomToPlayhead = true,
	className,
}: EditorTransportProps) {
	return (
		<FloatingToolbar aria-label={ariaLabel} compact className={cn("px-1.5", className)}>
			<span className="min-w-[3.25rem] px-1.5 text-right text-[11px] font-medium tabular-nums text-surface-foreground-muted">
				{currentTimeLabel}
			</span>
			<Button
				type="button"
				variant="toolbar"
				size="icon-sm"
				iconSize="sm"
				onClick={onSkipBack}
				aria-label={skipBackLabel}
				title={skipBackLabel}
			>
				<SkipBack weight="fill" />
			</Button>
			<Button
				type="button"
				variant="toolbar"
				size="icon-sm"
				iconSize="sm"
				onClick={onTogglePlayPause}
				aria-label={isPlaying ? pauseLabel : playLabel}
				aria-pressed={isPlaying}
				title={isPlaying ? pauseLabel : playLabel}
				className="bg-surface-foreground text-surface-foreground-inverse shadow-aureo-1 hover:bg-surface-foreground/90 hover:text-surface-foreground-inverse"
			>
				{isPlaying ? <Pause weight="fill" /> : <Play weight="fill" />}
			</Button>
			<Button
				type="button"
				variant="toolbar"
				size="icon-sm"
				iconSize="sm"
				onClick={onSkipForward}
				aria-label={skipForwardLabel}
				title={skipForwardLabel}
			>
				<SkipForward weight="fill" />
			</Button>
			<span className="min-w-[3.25rem] px-1.5 text-[11px] font-medium tabular-nums text-surface-foreground-muted">
				{durationLabel}
			</span>
			<span aria-hidden="true" className="mx-0.5 h-4 w-px bg-hairline" />
			<Button
				type="button"
				variant="toolbar"
				size="icon-sm"
				iconSize="sm"
				onClick={onSplitClip}
				disabled={!canSplit}
				aria-label={splitClipLabel}
				title={splitClipLabel}
			>
				<Scissors />
			</Button>
			<Button
				type="button"
				variant="toolbar"
				size="icon-sm"
				iconSize="sm"
				onClick={onZoomToPlayhead}
				disabled={!canZoomToPlayhead}
				aria-label={zoomToPlayheadLabel}
				title={zoomToPlayheadLabel}
			>
				<MagnifyingGlassPlus />
			</Button>
		</FloatingToolbar>
	);
}
