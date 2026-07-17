import {
	MicrophoneIcon,
	MicrophoneSlashIcon,
	SparkleIcon,
	SpeakerHighIcon,
	SpeakerXIcon,
} from "@phosphor-icons/react";
import { type ReactElement, useCallback, useRef } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import type { VoiceEnhancementMode } from "@/hooks/useScreenRecorder";
import styles from "../LaunchWindow.module.css";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";
import type { DeviceOption } from "./launchPopoverTypes";
import { DropdownItem, HudPopover, MicDeviceRow } from "./PopoverScaffold";

const POPOVER_ID = "mic";

export function MicPopover({
	trigger,
	disabled,
	systemAudioEnabled,
	onToggleSystemAudio,
	microphoneEnabled,
	voiceEnhancementMode,
	onVoiceEnhancementModeChange,
	onDisableMicrophone,
	devices,
	microphoneDeviceId,
	selectedDeviceId,
	attachMeter,
	onSelectDevice,
}: {
	trigger: ReactElement;
	disabled?: boolean;
	systemAudioEnabled: boolean;
	onToggleSystemAudio: () => void;
	microphoneEnabled: boolean;
	voiceEnhancementMode: VoiceEnhancementMode;
	onVoiceEnhancementModeChange: (mode: VoiceEnhancementMode) => void;
	onDisableMicrophone: () => void;
	devices: DeviceOption[];
	microphoneDeviceId?: string;
	selectedDeviceId?: string;
	attachMeter: (element: HTMLElement | null) => () => void;
	onSelectDevice: (deviceId: string) => void;
}) {
	const t = useScopedT("launch");
	const { isOpen, requestOpen, requestClose } = useLaunchPopoverCoordinator();
	const open = isOpen(POPOVER_ID);
	const meterCleanupRef = useRef<() => void>();
	const attachPopoverMeter = useCallback(
		(element: HTMLDivElement | null) => {
			meterCleanupRef.current?.();
			meterCleanupRef.current = attachMeter(element);
		},
		[attachMeter],
	);

	return (
		<HudPopover
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					requestClose(POPOVER_ID);
					return;
				}
				if (disabled) {
					return;
				}
				requestOpen(POPOVER_ID);
			}}
			trigger={trigger}
			align="start"
		>
			{microphoneEnabled && (
				<div className="flex items-center gap-2 border-b border-[var(--launch-border)] px-3 py-3">
					<MicrophoneIcon size={15} className="shrink-0 text-[var(--launch-accent)]" />
					<div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[var(--launch-border-strong)]">
						<div
							ref={attachPopoverMeter}
							className="absolute inset-0 origin-left rounded-full bg-[var(--launch-accent)]"
							style={{ transform: "scaleX(0)" }}
						/>
					</div>
				</div>
			)}
			<div className={styles.ddLabel}>{t("recording.microphone")}</div>
			<DropdownItem
				icon={
					systemAudioEnabled ? <SpeakerHighIcon size={16} /> : <SpeakerXIcon size={16} />
				}
				selected={systemAudioEnabled}
				onClick={onToggleSystemAudio}
			>
				{systemAudioEnabled
					? t("recording.disableSystemAudio")
					: t("recording.enableSystemAudio")}
			</DropdownItem>
			{microphoneEnabled && (
				<DropdownItem
					icon={<MicrophoneSlashIcon size={16} />}
					onClick={() => {
						onDisableMicrophone();
						requestClose(POPOVER_ID);
					}}
				>
					{t("recording.turnOffMicrophone")}
				</DropdownItem>
			)}
			{microphoneEnabled && (
				<>
					<div className={styles.ddLabel}>
						{t("recording.aiVoiceCleanup", "AI Voice Cleanup")}
					</div>
					{(["off", "standard", "strong"] as const).map((mode) => (
						<DropdownItem
							key={mode}
							icon={<SparkleIcon size={16} />}
							selected={voiceEnhancementMode === mode}
							onClick={() => onVoiceEnhancementModeChange(mode)}
						>
							{t(
								`recording.voiceCleanup.${mode}`,
								mode === "off"
									? "Off"
									: mode === "standard"
										? "Standard"
										: "Strong",
							)}
						</DropdownItem>
					))}
				</>
			)}
			{!microphoneEnabled && (
				<div className="px-3 py-2 text-xs text-[var(--launch-text-muted)]">
					{t("recording.selectMicToEnable")}
				</div>
			)}
			{devices.map((device) => (
				<MicDeviceRow
					key={device.deviceId}
					device={device}
					selected={
						microphoneEnabled &&
						(microphoneDeviceId === device.deviceId ||
							selectedDeviceId === device.deviceId)
					}
					onSelect={() => onSelectDevice(device.deviceId)}
				/>
			))}
			{devices.length === 0 && (
				<div className="text-center text-xs text-[var(--launch-text-muted)] py-4">
					{t("recording.noMicrophonesFound")}
				</div>
			)}
		</HudPopover>
	);
}
