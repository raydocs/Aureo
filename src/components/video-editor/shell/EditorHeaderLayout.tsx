import type { CSSProperties, ReactNode } from "react";

interface EditorHeaderLayoutProps {
	ariaLabel: string;
	leading: ReactNode;
	identity: ReactNode;
	actions: ReactNode;
}

const dragRegionStyle = { WebkitAppRegion: "drag" } as CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

export function EditorHeaderLayout({
	ariaLabel,
	leading,
	identity,
	actions,
}: EditorHeaderLayoutProps) {
	return (
		<header
			aria-label={ariaLabel}
			className="glass editor-liquid-header relative z-50 grid h-[52px] flex-shrink-0 grid-cols-[auto_minmax(150px,1fr)_auto] items-center gap-3 rounded-none border-x-0 border-t-0 px-3"
			style={dragRegionStyle}
		>
			<div
				data-editor-header-slot="leading"
				className="flex min-w-0 items-center gap-1.5 overflow-hidden justify-self-start"
				style={noDragRegionStyle}
			>
				{leading}
			</div>
			<div
				data-editor-header-slot="identity"
				className="flex min-w-0 max-w-[min(34vw,360px)] items-center justify-center justify-self-start"
				style={noDragRegionStyle}
			>
				{identity}
			</div>
			<div
				data-editor-header-slot="actions"
				className="flex min-w-0 items-center justify-end gap-1.5 justify-self-end"
				style={noDragRegionStyle}
			>
				{actions}
			</div>
		</header>
	);
}
