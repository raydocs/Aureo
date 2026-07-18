import { FrameCornersIcon } from "@phosphor-icons/react";
import { type ReactElement } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import { RECORDING_QUALITY_PRESETS, type RecordingQualityPresetId } from "@/hooks/recordingQuality";
import styles from "../LaunchWindow.module.css";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";
import { DropdownItem, HudPopover } from "./PopoverScaffold";

const POPOVER_ID = "quality";

interface QualityPresetPopoverProps {
	presetId: RecordingQualityPresetId;
	onSelectPreset: (presetId: RecordingQualityPresetId) => void;
	trigger: ReactElement;
	disabled?: boolean;
}

export function QualityPresetPopover({
	presetId,
	onSelectPreset,
	trigger,
	disabled,
}: QualityPresetPopoverProps) {
	const t = useScopedT("launch");
	const { isOpen, requestOpen, requestClose } = useLaunchPopoverCoordinator();
	const coordinatorOpen = isOpen(POPOVER_ID);
	const open = !disabled && coordinatorOpen;

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
			aria-label={t("recording.qualityPreset")}
			align="center"
		>
			<div className={styles.ddLabel}>{t("recording.qualityPreset")}</div>
			{RECORDING_QUALITY_PRESETS.map((option) => (
				<DropdownItem
					key={option.id}
					role="menuitemradio"
					icon={<FrameCornersIcon size={16} />}
					selected={presetId === option.id}
					onClick={() => {
						onSelectPreset(option.id);
						requestClose(POPOVER_ID);
					}}
					trailing={
						<span className="ml-auto text-[11px] text-[var(--launch-text-muted)] tabular-nums">
							{option.resolutionLabel} / {option.frameRate} FPS
						</span>
					}
				>
					{option.label}
				</DropdownItem>
			))}
		</HudPopover>
	);
}
