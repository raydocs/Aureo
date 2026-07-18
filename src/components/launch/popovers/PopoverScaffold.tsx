import { MicrophoneIcon, MicrophoneSlashIcon } from "@phosphor-icons/react";
import type { ReactElement, ReactNode } from "react";
import { AudioLevelMeter } from "@/components/ui/audio-level-meter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAudioLevelMeter } from "@/hooks/useAudioLevelMeter";
import styles from "../LaunchWindow.module.css";
import "../launchTheme.css";
import { useHudInteraction } from "../contexts/HudInteractionContext";
import type { DeviceOption } from "./launchPopoverTypes";

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
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger: ReactElement;
	children: ReactNode;
	align?: "start" | "center" | "end";
	role?: "menu" | "dialog" | "region";
	ariaLabel?: string;
}) {
	const { onMouseEnter } = useHudInteraction();
	return (
		<Popover open={open} onOpenChange={onOpenChange} modal={false}>
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
				role={role}
				aria-label={ariaLabel}
			>
				{children}
			</PopoverContent>
		</Popover>
	);
}
