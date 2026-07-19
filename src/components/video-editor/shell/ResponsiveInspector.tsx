import { X } from "@phosphor-icons/react";
import { type HTMLAttributes, type ReactNode, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResponsiveInspectorProps = {
	isDocked: boolean;
	open: boolean;
	label: string;
	closeLabel: string;
	onDismiss: () => void;
	sectionSwitcher: ReactNode;
	children: ReactNode;
};

export function resolveInspectorTabTarget<T>(
	focusableElements: T[],
	activeElement: unknown,
	shiftKey: boolean,
): T | null {
	if (focusableElements.length === 0) return null;

	const first = focusableElements[0];
	const last = focusableElements[focusableElements.length - 1];
	if (!focusableElements.includes(activeElement as T)) return shiftKey ? last : first;
	if (shiftKey && activeElement === first) return last;
	if (!shiftKey && activeElement === last) return first;
	return null;
}

export function getInspectorBackgroundIsolationProps(isModalOpen: boolean) {
	return isModalOpen ? { "aria-hidden": true as const, inert: "" } : {};
}

export function resolveInspectorKeyboardAction(key: string) {
	if (key === "Escape") return "dismiss" as const;
	if (key === "Tab") return "contain" as const;
	return null;
}

export function shouldHandleInspectorKeyboardEvent(
	panel: Pick<HTMLElement, "contains">,
	target: EventTarget | null,
) {
	return target !== null && panel.contains(target as Node);
}

export function InspectorBackground({
	children,
	isolated,
	...props
}: HTMLAttributes<HTMLDivElement> & { isolated: boolean }) {
	return (
		<div {...getInspectorBackgroundIsolationProps(isolated)} {...props}>
			{children}
		</div>
	);
}

function getFocusableElements(panel: HTMLElement): HTMLElement[] {
	return Array.from(
		panel.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter(
		(element) =>
			element.getAttribute("aria-hidden") !== "true" &&
			element.getAttribute("data-inspector-hidden-control") !== "true",
	);
}

export function ResponsiveInspector({
	isDocked,
	open,
	label,
	closeLabel,
	onDismiss,
	sectionSwitcher,
	children,
}: ResponsiveInspectorProps) {
	const panelRef = useRef<HTMLElement | null>(null);
	const onDismissRef = useRef(onDismiss);
	const isModalOpen = !isDocked && open;
	const mode = isDocked ? "docked" : isModalOpen ? "modal" : "closed";

	useEffect(() => {
		onDismissRef.current = onDismiss;
	}, [onDismiss]);

	useEffect(() => {
		if (!isModalOpen) return;

		const focusFrame = window.requestAnimationFrame(() => {
			const panel = panelRef.current;
			if (!panel) return;
			const initialTarget = panel.querySelector<HTMLElement>(
				"[data-inspector-initial-focus]",
			);
			(initialTarget ?? getFocusableElements(panel)[0] ?? panel).focus({
				preventScroll: true,
			});
		});

		const handleKeyDown = (event: KeyboardEvent) => {
			const panel = panelRef.current;
			if (!panel || !shouldHandleInspectorKeyboardEvent(panel, event.target)) return;

			const action = resolveInspectorKeyboardAction(event.key);
			if (action === "dismiss") {
				event.preventDefault();
				event.stopPropagation();
				onDismissRef.current();
				return;
			}

			if (action !== "contain") return;
			const focusableElements = getFocusableElements(panel);
			const target = resolveInspectorTabTarget(
				focusableElements,
				document.activeElement,
				event.shiftKey,
			);
			if (focusableElements.length === 0) {
				event.preventDefault();
				panel.focus({ preventScroll: true });
			} else if (target) {
				event.preventDefault();
				target.focus({ preventScroll: true });
			}
		};

		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			window.cancelAnimationFrame(focusFrame);
			document.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [isModalOpen]);

	return (
		<>
			{isModalOpen ? (
				<div
					data-inspector-backdrop="true"
					aria-hidden="true"
					className="absolute inset-0 z-30 bg-black/45"
					onPointerDown={() => onDismissRef.current()}
				/>
			) : null}
			<aside
				ref={panelRef}
				id="editor-inspector"
				role={isModalOpen ? "dialog" : "complementary"}
				aria-modal={isModalOpen ? "true" : undefined}
				aria-label={label}
				tabIndex={isModalOpen ? -1 : undefined}
				data-inspector-mode={mode}
				className={cn(
					"min-h-0 flex-shrink-0 flex-col gap-2",
					isDocked && "flex",
					mode === "closed" && "hidden",
					isModalOpen &&
						"absolute inset-y-4 right-4 z-40 flex w-[346px] overflow-hidden rounded-surface border border-hairline bg-editor-bg p-3 shadow-aureo-3",
				)}
			>
				<div
					className={cn(
						"flex flex-shrink-0 items-center justify-end",
						isDocked && "hidden",
					)}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={() => onDismissRef.current()}
						title={closeLabel}
						aria-label={closeLabel}
						data-inspector-initial-focus="true"
						data-inspector-hidden-control={isDocked ? "true" : undefined}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
				{sectionSwitcher}
				{children}
			</aside>
		</>
	);
}
