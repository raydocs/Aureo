import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { SourceSelector } from "../SourceSelector";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";
import {
	type CaptureSourceType,
	type DesktopSource,
	isScreenSource,
	isWindowSource,
	mapRawSource,
} from "./launchPopoverTypes";

const POPOVER_ID = "sources";

export function SourcePopover({
	trigger,
	selectedSource,
	selectedSourceType,
	onSourceSelect,
	onOpen,
	initialMode,
	onModeChange,
	onCloseAutoFocus,
}: {
	trigger: ReactNode;
	selectedSource: string;
	selectedSourceType?: CaptureSourceType;
	onSourceSelect: (source: DesktopSource) => Promise<void> | void;
	onOpen?: () => void;
	initialMode?: CaptureSourceType;
	onModeChange?: (mode: CaptureSourceType) => void;
	onCloseAutoFocus?: (event: Event) => void;
}) {
	const { isOpen, requestOpen, requestClose } = useLaunchPopoverCoordinator();
	const [sources, setSources] = useState<DesktopSource[]>([]);
	const [loading, setLoading] = useState(false);
	const [viewMode, setViewMode] = useState<CaptureSourceType>(
		initialMode ?? selectedSourceType ?? "screen",
	);
	const open = isOpen(POPOVER_ID);

	useEffect(() => {
		if (open) {
			if (initialMode) setViewMode(initialMode);
		} else {
			setViewMode(selectedSourceType ?? "screen");
		}
	}, [open, initialMode, selectedSourceType]);

	const fetchSources = useCallback(async () => {
		if (!window.electronAPI) return;
		setLoading(true);
		try {
			const rawSources = await window.electronAPI.getSources({
				types: ["screen", "window"],
				thumbnailSize: { width: 160, height: 90 },
				fetchWindowIcons: true,
			});
			setSources(rawSources.map((s) => mapRawSource(s as DesktopSource)));
		} catch (error) {
			console.error("Failed to fetch sources:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	const screenSources = useMemo(() => sources.filter(isScreenSource), [sources]);
	const windowSources = useMemo(() => sources.filter(isWindowSource), [sources]);

	const handleSourceSelect = useCallback(
		async (source: DesktopSource) => {
			try {
				await onSourceSelect(source);
				requestClose(POPOVER_ID);
			} catch (error) {
				console.error("Failed to select source:", error);
			}
		},
		[onSourceSelect, requestClose],
	);

	return (
		<SourceSelector
			screenSources={screenSources}
			windowSources={windowSources}
			selectedSource={selectedSource}
			selectedSourceType={selectedSourceType}
			loading={loading}
			onSourceSelect={handleSourceSelect}
			onFetchSources={fetchSources}
			open={open}
			mode={viewMode}
			onCloseAutoFocus={onCloseAutoFocus}
			onModeChange={(nextMode) => {
				setViewMode(nextMode);
				onModeChange?.(nextMode);
			}}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					requestClose(POPOVER_ID);
					return;
				}
				onOpen?.();
				requestOpen(POPOVER_ID);
			}}
		>
			{trigger}
		</SourceSelector>
	);
}
