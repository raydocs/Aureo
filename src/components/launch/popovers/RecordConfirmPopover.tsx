import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { useScopedT } from "@/contexts/I18nContext";
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
			trigger={trigger}
			align="end"
		>
			<div className="p-3">
				<p className="text-sm leading-5 text-[var(--launch-text)]">
					{t("recording.preflightMutedCameraBody")}
				</p>
				<div className="mt-4 flex justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={() => requestClose(POPOVER_ID)}>
						{t("recording.cancel")}
					</Button>
					<Button
						size="sm"
						onClick={() => {
							requestClose(POPOVER_ID);
							onRecordAnyway();
						}}
					>
						{t("recording.preflightRecordAnyway")}
					</Button>
				</div>
			</div>
		</HudPopover>
	);
}
