import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const floatingToolbarVariants = cva(
	[
		"glass inline-flex items-center gap-1",
		"rounded-surface border-hairline p-1.5",
		"shadow-aureo-3 text-surface-foreground",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
	],
	{
		variants: {
			orientation: {
				horizontal: "flex-row",
				vertical: "flex-col",
			},
			compact: {
				true: "gap-0.5 p-1",
				false: "",
			},
		},
		defaultVariants: {
			orientation: "horizontal",
			compact: false,
		},
	},
);

export interface FloatingToolbarProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof floatingToolbarVariants> {
	/** Accessible label for the toolbar (required). */
	"aria-label": string;
}

export function getToolbarNavigationIndex(
	currentIndex: number,
	controlCount: number,
	key: string,
	orientation: "horizontal" | "vertical",
): number | null {
	if (controlCount <= 0) return null;

	const previousKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
	const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
	if (key === "Home") return 0;
	if (key === "End") return controlCount - 1;
	if (key === nextKey) return (Math.max(currentIndex, -1) + 1) % controlCount;
	if (key === previousKey) return (currentIndex <= 0 ? controlCount : currentIndex) - 1;
	return null;
}

const FloatingToolbar = React.forwardRef<HTMLDivElement, FloatingToolbarProps>(
	({ className, orientation, compact, children, onKeyDown, ...props }, ref) => {
		const resolvedOrientation = orientation ?? "horizontal";

		return (
			<div
				ref={ref}
				role="toolbar"
				aria-orientation={resolvedOrientation}
				data-orientation={resolvedOrientation}
				data-floating-toolbar=""
				className={cn(floatingToolbarVariants({ orientation, compact, className }))}
				onKeyDown={(event) => {
					onKeyDown?.(event);
					if (event.defaultPrevented) return;
					if (
						(event.target as HTMLElement).matches(
							'input, select, textarea, [contenteditable="true"]',
						)
					) {
						return;
					}

					const controls = Array.from(
						event.currentTarget.querySelectorAll<HTMLElement>(
							'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
						),
					);
					const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
					const nextIndex = getToolbarNavigationIndex(
						currentIndex,
						controls.length,
						event.key,
						resolvedOrientation,
					);
					if (nextIndex === null) return;

					event.preventDefault();
					controls[nextIndex]?.focus();
				}}
				{...props}
			>
				{children}
			</div>
		);
	},
);
FloatingToolbar.displayName = "FloatingToolbar";

export { FloatingToolbar, floatingToolbarVariants };
