import { MicrophoneIcon, MicrophoneSlashIcon } from "@phosphor-icons/react";
import { type KeyboardEvent, type ReactElement, type ReactNode, useCallback, useRef } from "react";
import { AudioLevelMeter } from "@/components/ui/audio-level-meter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAudioLevelMeter } from "@/hooks/useAudioLevelMeter";
import styles from "../LaunchWindow.module.css";
import "../launchTheme.css";
import { useHudInteraction } from "../contexts/HudInteractionContext";
import type { DeviceOption } from "./launchPopoverTypes";

const MENU_ITEM_SELECTOR =
	'[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)';

export function resolveMenuNavigationIndex(
	currentIndex: number,
	itemCount: number,
	key: string,
): number | null {
	if (itemCount <= 0) return null;
	if (key === "Home") return 0;
	if (key === "End") return itemCount - 1;
	if (key === "ArrowDown") return currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount;
	if (key === "ArrowUp")
		return currentIndex < 0 ? itemCount - 1 : (currentIndex - 1 + itemCount) % itemCount;
	return null;
}

export function DropdownItem({
	onClick,
	selected,
	icon,
	children,
	trailing,
	role = "menuitem",
	disabled = false,
}: {
	onClick: () => void;
	selected?: boolean;
	icon: ReactNode;
	children: ReactNode;
	trailing?: ReactNode;
	role?: "menuitem" | "menuitemradio" | "menuitemcheckbox";
	disabled?: boolean;
}) {
	const supportsCheckedState = role === "menuitemradio" || role === "menuitemcheckbox";
	return (
		<button
			type="button"
			role={role}
			tabIndex={-1}
			aria-checked={supportsCheckedState ? Boolean(selected) : undefined}
			className={`${styles.ddItem} ${selected ? styles.ddItemSelected : ""}`}
			disabled={disabled}
			onClick={onClick}
		>
			<span className="shrink-0">{icon}</span>
			<span className="truncate">{children}</span>
			{trailing}
		</button>
	);
}

export function MicDeviceRow({
	device,
	selected,
	onSelect,
}: {
	device: DeviceOption;
	selected: boolean;
	onSelect: () => void;
}) {
	const { level } = useAudioLevelMeter({
		enabled: true,
		deviceId: device.deviceId,
	});

	return (
		<button
			type="button"
			role="menuitemradio"
			tabIndex={-1}
			aria-checked={selected}
			className={`${styles.ddItem} ${selected ? styles.ddItemSelected : ""}`}
			onClick={onSelect}
		>
			<span className="shrink-0">
				{selected ? <MicrophoneIcon size={16} /> : <MicrophoneSlashIcon size={16} />}
			</span>
			<span className="truncate flex-1">{device.label}</span>
			<AudioLevelMeter level={level} className="w-16 shrink-0" />
		</button>
	);
}

export function HudPopover({
	open,
	onOpenChange,
	trigger,
	children,
	align = "center",
	role = "menu",
	ariaLabel,
	modal = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger: ReactElement;
	children: ReactNode;
	align?: "start" | "center" | "end";
	role?: "menu" | "dialog" | "region";
	ariaLabel?: string;
	modal?: boolean;
}) {
	const { onMouseEnter } = useHudInteraction();
	const typeaheadRef = useRef({ value: "", at: 0 });
	const handleMenuKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (role !== "menu") return;
			const items = Array.from(
				event.currentTarget.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR),
			);
			const currentIndex = items.indexOf(document.activeElement as HTMLElement);
			const nextIndex = resolveMenuNavigationIndex(currentIndex, items.length, event.key);
			if (nextIndex !== null) {
				event.preventDefault();
				items[nextIndex]?.focus();
				return;
			}
			if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;

			const now = Date.now();
			const nextValue =
				now - typeaheadRef.current.at > 500
					? event.key.toLocaleLowerCase()
					: `${typeaheadRef.current.value}${event.key.toLocaleLowerCase()}`;
			typeaheadRef.current = { value: nextValue, at: now };
			const ordered = [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex + 1)];
			const match = ordered.find((item) =>
				item.textContent?.trim().toLocaleLowerCase().startsWith(nextValue),
			);
			if (match) {
				event.preventDefault();
				match.focus();
			}
		},
		[role],
	);
	return (
		<Popover open={open} onOpenChange={onOpenChange} modal={modal}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent
				className={`launch-theme launch-hud-theme ${styles.menuCard} ${styles.electronNoDrag}`}
				data-hud-interactive
				unstyled
				side="top"
				align={align}
				sideOffset={8}
				avoidCollisions
				collisionPadding={12}
				usePortal={false}
				onMouseEnter={onMouseEnter}
				onOpenAutoFocus={(event) => {
					if (role !== "menu") return;
					event.preventDefault();
					const content = event.currentTarget as HTMLElement;
					queueMicrotask(() => {
						const items = Array.from(
							content.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR),
						);
						(
							items.find((item) => item.getAttribute("aria-checked") === "true") ??
							items[0]
						)?.focus();
					});
				}}
				onKeyDown={handleMenuKeyDown}
				role={role}
				aria-label={ariaLabel}
			>
				{children}
			</PopoverContent>
		</Popover>
	);
}
