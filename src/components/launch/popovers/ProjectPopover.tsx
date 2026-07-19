import type { ReactElement } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import type { ProjectLibraryEntry } from "../../video-editor/ProjectBrowserDialog";
import ProjectBrowserDialog from "../../video-editor/ProjectBrowserDialog";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";
import { HudPopover } from "./PopoverScaffold";

const POPOVER_ID = "projects";

export function ProjectPopover({
	trigger,
	entries,
	onOpenProject,
	returnFocusRef,
}: {
	trigger: ReactElement;
	entries: ProjectLibraryEntry[];
	onOpenProject: (projectPath: string) => void;
	returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
	const t = useScopedT("launch");
	const { isOpen, requestOpen, requestClose } = useLaunchPopoverCoordinator();
	const open = isOpen(POPOVER_ID);

	return (
		<HudPopover
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					requestClose(POPOVER_ID);
					return;
				}
				requestOpen(POPOVER_ID);
			}}
			role="dialog"
			aria-label={t("recording.openProject")}
			modal
			trigger={trigger}
			align="center"
		>
			<ProjectBrowserDialog
				open={open}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) requestClose(POPOVER_ID);
				}}
				entries={entries}
				anchorRef={returnFocusRef}
				renderMode="inline"
				onOpenProject={(path) => {
					onOpenProject(path);
					requestClose(POPOVER_ID);
				}}
			/>
		</HudPopover>
	);
}
