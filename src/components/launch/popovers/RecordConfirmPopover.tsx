import type { ReactElement } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import styles from "../LaunchWindow.module.css";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";
import { HudPopover } from "./PopoverScaffold";

const POPOVER_ID = "record-confirm";

export function RecordConfirmPopover({
	trigger,
	onRecordAnyway,
}: {
	trigger: ReactElement;
	onRecordAnyway: () => void;
}) {
	const t = useScopedT("launch");
	const { isOpen, requestClose } = useLaunchPopoverCoordinator();
	const open = isOpen(POPOVER_ID);

	return (
		<HudPopover
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					requestClose(POPOVER_ID);
				}
			}}
			role="dialog"
			aria-label={t("recording.recordConfirm", "Record confirmation")}
			trigger={trigger}
			align="end"
		>
			<div className="p-3">
				<p className="text-sm leading-5 text-[var(--launch-text)]">
					{t("recording.preflightMutedCameraBody")}
				</p>
				<div className="mt-4 flex justify-end gap-2">
					<button
						type="button"
						className={styles.confirmAction}
						onClick={() => requestClose(POPOVER_ID)}
					>
						{t("recording.cancel")}
					</button>
					<button
						type="button"
						className={`${styles.confirmAction} ${styles.confirmActionPrimary}`}
						onClick={() => {
							requestClose(POPOVER_ID);
							onRecordAnyway();
						}}
					>
						{t("recording.preflightRecordAnyway")}
					</button>
				</div>
			</div>
		</HudPopover>
	);
}
