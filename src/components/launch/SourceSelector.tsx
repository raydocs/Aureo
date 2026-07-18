import {
	AppWindowIcon,
	CaretUpIcon,
	FrameCornersIcon,
	MonitorIcon,
	SelectionSlashIcon,
	VideoCameraIcon,
} from "@phosphor-icons/react";
import * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScopedT } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import {
	type CaptureSourceType,
	type DesktopSource,
	isScreenSource,
	isWindowSource,
	mapRawSource,
} from "./popovers/launchPopoverTypes";
import "./launchTheme.css";
import "./SourceSelector.css";
import { useHudInteraction } from "./contexts/HudInteractionContext";

type SourceMode = "screen" | "window" | "area" | "device";

interface DeviceSourceState {
	devices: DesktopSource[];
	loading: boolean;
	error: string | null;
}

interface SourceSelectorProps {
	/** List of available screen sources */
	screenSources?: DesktopSource[];
	/** List of available window sources */
	windowSources?: DesktopSource[];
	/** Currently selected source name */
	selectedSource?: string;
	/** Currently selected source type */
	selectedSourceType?: CaptureSourceType;
	/** Loading state for desktop sources */
	loading?: boolean;
	/** Callback when a source is selected */
	onSourceSelect?: (source: DesktopSource) => void;
	/** Callback to fetch desktop sources */
	onFetchSources?: () => Promise<void>;
	/** Whether the popover is open */
	open?: boolean;
	/** Callback when open state changes */
	onOpenChange?: (open: boolean) => void;
	/** Optional custom trigger element */
	children?: React.ReactNode;
}

export function MarqueeText({ text }: { text: string }) {
	const staticRef = useRef<HTMLSpanElement>(null);
	const [overflowing, setOverflowing] = useState(false);

	useLayoutEffect(() => {
		const node = staticRef.current;
		if (!node) return;
		const checkOverflow = () => {
			setOverflowing(node.scrollWidth > node.clientWidth + 1);
		};
		checkOverflow();
		const observer = new ResizeObserver(checkOverflow);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			className="w-full source-selector-marquee"
			data-overflowing={overflowing ? "true" : "false"}
		>
			<span ref={staticRef} className="source-selector-marquee-static">
				{text}
			</span>
			<span className="source-selector-marquee-animated">
				<span className="source-selector-marquee-track">
					<span className="source-selector-marquee-segment">{text}</span>
					<span className="source-selector-marquee-segment source-selector-marquee-duplicate">
						{text}
					</span>
				</span>
			</span>
		</div>
	);
}

export function buildDeviceSource(device: MediaDeviceInfo, index: number): DesktopSource {
	const label = device.label || `Video device ${index + 1}`;
	return {
		id: `device:${device.deviceId}`,
		name: label,
		thumbnail: null,
		display_id: "",
		appIcon: null,
		sourceType: "device",
		deviceId: device.deviceId,
	};
}

async function enumerateVideoDevices(): Promise<MediaDeviceInfo[]> {
	if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
		return [];
	}
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter((d) => d.kind === "videoinput");
	} catch (error) {
		console.error("Failed to enumerate video devices:", error);
		throw error;
	}
}

const allModes: SourceMode[] = ["screen", "window", "area", "device"];

function normalizeMode(mode: CaptureSourceType | undefined): SourceMode {
	switch (mode) {
		case "screen":
		case "window":
		case "area":
		case "device":
			return mode;
		default:
			return "screen";
	}
}

function iconForMode(mode: SourceMode) {
	switch (mode) {
		case "screen":
			return MonitorIcon;
		case "window":
			return AppWindowIcon;
		case "area":
			return FrameCornersIcon;
		case "device":
			return VideoCameraIcon;
	}
}

function labelKeyForMode(mode: SourceMode): string {
	switch (mode) {
		case "screen":
			return "screens";
		case "window":
			return "windows";
		case "area":
			return "area";
		case "device":
			return "device";
	}
}

function fallbackLabelForMode(mode: SourceMode): string {
	switch (mode) {
		case "screen":
			return "Screens";
		case "window":
			return "Windows";
		case "area":
			return "Area";
		case "device":
			return "Device";
	}
}

/**
 * SourceSelectorContent - The actual list of sources
 */
export const SourceSelectorContent = ({
	screenSources = [],
	windowSources = [],
	selectedSource = "Screen",
	selectedSourceType = "screen",
	loading = false,
	open = false,
	onSourceSelect = () => undefined,
	onOpenAreaSelector,
}: Pick<
	SourceSelectorProps,
	| "screenSources"
	| "windowSources"
	| "selectedSource"
	| "selectedSourceType"
	| "loading"
	| "onSourceSelect"
> & { open?: boolean; onOpenAreaSelector?: () => Promise<DesktopSource | null> }) => {
	const t = useScopedT("launch");
	const listRef = useRef<HTMLDivElement>(null);
	const tabsRef = useRef<HTMLDivElement>(null);
	const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());
	const [mode, setMode] = useState<SourceMode>(normalizeMode(selectedSourceType));
	const [deviceState, setDeviceState] = useState<DeviceSourceState>({
		devices: [],
		loading: false,
		error: null,
	});

	useEffect(() => {
		setMode(normalizeMode(selectedSourceType));
	}, [selectedSourceType]);

	const orderedSources = useMemo(() => {
		switch (mode) {
			case "screen":
				return screenSources;
			case "window":
				return windowSources;
			case "device":
				return deviceState.devices;
			default:
				return [];
		}
	}, [mode, screenSources, windowSources, deviceState.devices]);
	const hasSelectedSource = orderedSources.some((source) => source.name === selectedSource);

	// Enumerate video devices while the popover is open, and listen for device changes
	useEffect(() => {
		if (mode !== "device" || !open) return;
		let cancelled = false;
		setDeviceState((prev) => ({ ...prev, loading: true, error: null }));
		const refresh = async () => {
			try {
				const devices = await enumerateVideoDevices();
				if (cancelled) return;
				setDeviceState({
					devices: devices.map(buildDeviceSource),
					loading: false,
					error: null,
				});
			} catch (error) {
				if (cancelled) return;
				setDeviceState((prev) => ({
					...prev,
					loading: false,
					error: error instanceof Error ? error.message : String(error),
				}));
			}
		};
		refresh();
		const handleDeviceChange = () => {
			if (!cancelled) void refresh();
		};
		navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
		return () => {
			cancelled = true;
			navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
		};
	}, [mode, open]);

	useEffect(() => {
		if (!open) return;
		const timeoutId = setTimeout(() => {
			const selected = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
			if (selected) {
				selected.focus();
				return;
			}
			const firstInteractive = listRef.current?.querySelector<HTMLElement>(
				mode === "area" ? ".source-selector-action-button" : '[role="option"]',
			);
			firstInteractive?.focus();
		}, 0);
		return () => clearTimeout(timeoutId);
	}, [open, mode]);

	const handleImageError = useCallback((sourceId: string) => {
		setFailedThumbnails((previous) => new Set([...previous, sourceId]));
	}, []);

	const handleOptionKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		source: DesktopSource,
	) => {
		let nextIndex: number | null = null;
		const currentIndex = orderedSources.findIndex((candidate) => candidate.id === source.id);
		if (currentIndex < 0) return;

		switch (event.key) {
			case "ArrowDown":
				nextIndex = (currentIndex + 1) % orderedSources.length;
				break;
			case "ArrowUp":
				nextIndex = (currentIndex - 1 + orderedSources.length) % orderedSources.length;
				break;
			case "Home":
				nextIndex = 0;
				break;
			case "End":
				nextIndex = orderedSources.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		const nextSource = orderedSources[nextIndex];
		if (!nextSource) return;
		onSourceSelect(nextSource);
		const options = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
		options?.[nextIndex]?.focus();
	};

	const handleTabKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		tabMode: SourceMode,
	) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		event.preventDefault();
		const currentIndex = allModes.indexOf(tabMode);
		const delta = event.key === "ArrowRight" ? 1 : -1;
		const nextIndex = (currentIndex + delta + allModes.length) % allModes.length;
		const nextMode = allModes[nextIndex];
		setMode(nextMode);
		const nextTab = tabsRef.current?.querySelector<HTMLButtonElement>(
			`[data-mode="${nextMode}"]`,
		);
		queueMicrotask(() => nextTab?.focus());
	};

	const handleAreaAction = async () => {
		if (!onOpenAreaSelector) return;
		try {
			const source = await onOpenAreaSelector();
			if (source) {
				onSourceSelect(source);
			}
		} catch (error) {
			console.error("Failed to open area selector:", error);
		}
	};

	const renderModeTabs = () => {
		return (
			<div
				ref={tabsRef}
				role="radiogroup"
				aria-label={t("recording.source", "Recording source")}
				className="source-selector-mode-tabs"
			>
				{allModes.map((tabMode) => {
					const ModeIcon = iconForMode(tabMode);
					const count =
						tabMode === "screen"
							? screenSources.length
							: tabMode === "window"
								? windowSources.length
								: tabMode === "device"
									? deviceState.devices.length
									: 0;
					const labelKey = labelKeyForMode(tabMode);
					const label = t(`sourceSelector.${labelKey}`, fallbackLabelForMode(tabMode));
					return (
						<button
							key={tabMode}
							type="button"
							role="radio"
							data-mode={tabMode}
							aria-checked={mode === tabMode}
							tabIndex={mode === tabMode ? 0 : -1}
							onClick={() => setMode(tabMode)}
							onKeyDown={(event) => handleTabKeyDown(event, tabMode)}
							className={cn(
								"source-selector-mode-tab",
								mode === tabMode && "source-selector-mode-tab-active",
							)}
						>
							<ModeIcon className="w-3.5 h-3.5" />
							{label}
							{tabMode === "screen" ||
							tabMode === "window" ||
							tabMode === "device" ? (
								<span
									className="source-selector-count"
									aria-label={`${count} ${label}`}
								>
									{count}
								</span>
							) : null}
						</button>
					);
				})}
			</div>
		);
	};

	const renderSourceItem = (source: DesktopSource, index: number) => {
		const isSelected = selectedSource === source.name;
		const label = source.windowTitle || source.name;
		const typeLabel = mode === "screen" ? t("recording.screen") : t("recording.window");
		const thumbnailFailed = failedThumbnails.has(source.id);
		const orderedIndex = orderedSources.findIndex((candidate) => candidate.id === source.id);
		const isTabStop = isSelected || (!hasSelectedSource && orderedIndex === 0);
		const ModeIcon = iconForMode(mode);
		return (
			<button
				key={`${source.id}-${index}`}
				type="button"
				role="option"
				aria-selected={isSelected}
				data-selected={isSelected}
				tabIndex={isTabStop ? 0 : -1}
				className={cn(
					"source-selector-item group min-h-[44px] w-full rounded-[11px] px-3 py-2 text-left font-medium flex items-center justify-start gap-3",
					isSelected && "source-selector-item-selected",
				)}
				onClick={() => onSourceSelect(source)}
				onKeyDown={(event) => handleOptionKeyDown(event, source)}
				title={label}
			>
				<div className="relative flex-shrink-0">
					{source.thumbnail && !thumbnailFailed ? (
						<img
							src={source.thumbnail}
							alt=""
							className="w-12 h-8 rounded-[8px] object-cover bg-black/50"
							onError={() => handleImageError(source.id)}
						/>
					) : (
						<div className="source-selector-thumb-fallback w-12 h-8 rounded-[8px] flex items-center justify-center">
							<ModeIcon className="w-5 h-5 source-selector-muted" />
						</div>
					)}
				</div>

				<div className="flex-1 min-w-0 flex flex-col items-start text-left">
					<div className="text-sm font-medium source-selector-text w-full">
						<MarqueeText text={label} />
					</div>
					<div className="text-xs source-selector-subtle truncate w-full text-left">
						{typeLabel}
					</div>
				</div>
			</button>
		);
	};

	const renderGroup = () => {
		const sources = orderedSources;
		const labelKey = labelKeyForMode(mode);
		const label = t(`sourceSelector.${labelKey}`, fallbackLabelForMode(mode));
		const ModeIcon = iconForMode(mode);
		const groupKey = mode;
		const isLoading = mode === "device" ? deviceState.loading : loading;
		return (
			<div key={mode} className="space-y-1" role="group" aria-label={label}>
				<div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] source-selector-label">
					{ModeIcon && <ModeIcon className="w-3.5 h-3.5" />}
					{label}
					{isLoading && (
						<span className="normal-case tracking-normal text-[10px] source-selector-muted opacity-100 transition-opacity duration-150">
							{t("common.loading", "Refreshing...")}
						</span>
					)}
				</div>
				{sources.length > 0 ? (
					<div className="space-y-0.5">
						{sources.map((source, index) => renderSourceItem(source, index))}
					</div>
				) : (
					<div className="px-3 py-4 text-xs source-selector-muted rounded-[11px] bg-[var(--launch-hover)]/30">
						{groupKey === "screen" &&
							t("sourceSelector.noScreensAvailable", "No screens available")}
						{groupKey === "window" &&
							t("sourceSelector.noWindowsAvailable", "No windows available")}
						{groupKey === "device" &&
							t("sourceSelector.noDevicesAvailable", "No video devices available")}
					</div>
				)}
			</div>
		);
	};

	const renderAreaPanel = () => {
		return (
			<div className="source-selector-action-panel">
				<FrameCornersIcon className="w-10 h-10 source-selector-muted" />
				<p className="source-selector-action-title">
					{t("sourceSelector.selectArea", "Select a recording area")}
				</p>
				<p className="source-selector-action-body">
					{t(
						"sourceSelector.areaDescription",
						"Drag across one or more displays to choose the exact area to record.",
					)}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleAreaAction}
					className="source-selector-action-button"
				>
					{t("sourceSelector.chooseArea", "Choose area")}
				</Button>
			</div>
		);
	};

	const renderErrorPanel = (message: string) => {
		return (
			<div className="source-selector-empty">
				<SelectionSlashIcon className="w-8 h-8" />
				<p>{t("sourceSelector.deviceError", "Could not list devices")}</p>
				<small>{message}</small>
			</div>
		);
	};

	const contentLoading = loading && orderedSources.length === 0 && mode !== "device";
	const modeHasList = mode === "screen" || mode === "window" || mode === "device";

	if (contentLoading) {
		return (
			<>
				{renderModeTabs()}
				<div className="flex items-center justify-center py-8">
					<div
						className="animate-spin rounded-full h-5 w-5 border-b-2 source-selector-accent-border"
						aria-labelledby="source-selector-header-title"
						role="status"
					/>
				</div>
			</>
		);
	}

	return (
		<div
			ref={listRef}
			className="max-h-[320px] overflow-y-auto overflow-x-hidden p-2 source-selector-scroll"
		>
			{renderModeTabs()}
			{mode === "area" ? (
				renderAreaPanel()
			) : deviceState.error && mode === "device" ? (
				renderErrorPanel(deviceState.error)
			) : (
				<div
					className="space-y-3"
					role={modeHasList ? "listbox" : undefined}
					aria-label={modeHasList ? t("recording.source", "Recording source") : undefined}
				>
					{renderGroup()}
				</div>
			)}
		</div>
	);
};

/**
 * SourceSelector - A rich source selection component with thumbnails
 * Uses Radix UI Popover for positioning and accessibility
 */
export const SourceSelector = React.memo(function SourceSelector({
	screenSources: propsScreenSources,
	windowSources: propsWindowSources,
	selectedSource: propsSelectedSource,
	selectedSourceType: propsSelectedSourceType,
	loading: propsLoading,
	onSourceSelect: propsOnSourceSelect,
	onFetchSources: propsOnFetchSources,
	open: propsOpen,
	onOpenChange: propsOnOpenChange,
	children,
}: SourceSelectorProps) {
	const t = useScopedT("launch");
	// Internal state for standalone/uncontrolled use
	const [internalOpen, setInternalOpen] = useState(false);
	const [internalSources, setInternalSources] = useState<DesktopSource[]>([]);
	const [internalLoading, setInternalLoading] = useState(false);
	const [internalSelectedSource, setInternalSelectedSource] = useState("Screen");
	const [internalSelectedSourceType, setInternalSelectedSourceType] =
		useState<CaptureSourceType>("screen");

	// Determine if we should use internal or external state/logic
	const isAutonomous = propsOpen === undefined;
	const open = propsOpen ?? internalOpen;
	const onOpenChange = propsOnOpenChange ?? setInternalOpen;
	const loading = propsLoading ?? internalLoading;
	const selectedSource = propsSelectedSource ?? internalSelectedSource;
	const selectedSourceType = propsSelectedSourceType ?? internalSelectedSourceType;

	// Default fetching logic
	const defaultFetchSources = useCallback(async () => {
		if (!window.electronAPI) return;
		setInternalLoading(true);
		try {
			const rawSources = await window.electronAPI.getSources({
				types: ["screen", "window"],
				thumbnailSize: { width: 160, height: 90 },
				fetchWindowIcons: true,
			});
			setInternalSources(rawSources.map((s) => mapRawSource(s as DesktopSource)));
		} catch (error) {
			console.error("Failed to fetch sources:", error);
		} finally {
			setInternalLoading(false);
		}
	}, []);

	const onFetchSources = propsOnFetchSources ?? defaultFetchSources;

	const onOpenAreaSelector = useCallback(async (): Promise<DesktopSource | null> => {
		if (!window.electronAPI?.openAreaSelector) return null;
		try {
			const result = await window.electronAPI.openAreaSelector();
			if (result && result.source) {
				return result.source as DesktopSource;
			}
			return null;
		} catch (error) {
			console.error("Failed to open area selector:", error);
			return null;
		}
	}, []);

	// Default selection logic
	const onSourceSelect = useCallback(
		async (source: DesktopSource) => {
			if (propsOnSourceSelect) {
				propsOnSourceSelect(source);
				return;
			}
			if (!window.electronAPI) return;
			try {
				const result = await window.electronAPI.selectSource(source);
				if (result) {
					setInternalSelectedSource(source.name);
					setInternalSelectedSourceType(source.sourceType ?? "screen");
				}
			} catch (error) {
				console.error("Failed to select source:", error);
			}
		},
		[propsOnSourceSelect],
	);

	// Split sources for internal use
	const internalScreenSources = useMemo(
		() => internalSources.filter(isScreenSource),
		[internalSources],
	);
	const internalWindowSources = useMemo(
		() => internalSources.filter(isWindowSource),
		[internalSources],
	);

	const screenSources = propsScreenSources ?? internalScreenSources;
	const windowSources = propsWindowSources ?? internalWindowSources;

	const hasPrefetchedRef = useRef(false);
	const fetchInFlightRef = useRef(false);
	const lastFetchedAtRef = useRef(0);

	const fetchSourcesOnce = useCallback(
		async (allowRecentSkip: boolean) => {
			if (fetchInFlightRef.current) {
				return;
			}
			if (allowRecentSkip && Date.now() - lastFetchedAtRef.current < 750) {
				return;
			}
			fetchInFlightRef.current = true;
			try {
				await onFetchSources();
				lastFetchedAtRef.current = Date.now();
			} finally {
				fetchInFlightRef.current = false;
			}
		},
		[onFetchSources],
	);

	const prefetchSources = React.useCallback(() => {
		if (hasPrefetchedRef.current) {
			return;
		}
		hasPrefetchedRef.current = true;
		void fetchSourcesOnce(false);
	}, [fetchSourcesOnce]);

	// Fetch sources when popover opens
	useEffect(() => {
		if (open) {
			void fetchSourcesOnce(true);
		}
	}, [open, fetchSourcesOnce]);

	// In autonomous mode, we might want to start open
	useEffect(() => {
		if (isAutonomous) {
			setInternalOpen(true);
		}
	}, [isAutonomous]);

	const trigger = children ? (
		React.isValidElement(children) ? (
			React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
				onPointerEnter: prefetchSources,
				onFocusCapture: prefetchSources,
			})
		) : (
			children
		)
	) : (
		<Button
			variant="outline"
			size="lg"
			onPointerEnter={prefetchSources}
			onFocusCapture={prefetchSources}
			className={cn(
				"group gap-2 px-3 min-w-0 max-w-[180px] rounded-[11px] font-medium text-[12px] [ -webkit-app-region:no-drag ] shrink-0",
				"border-[#2a2a34] bg-[#1a1a22] text-[#eeeef2] hover:border-[#3e3e4c] hover:bg-[#20202a] transition-all",
				"data-[state=open]:border-[#3e3e4c] data-[state=open]:bg-[#20202a]",
			)}
			title={selectedSource}
			aria-haspopup="listbox"
			aria-expanded={open}
		>
			{selectedSourceType === "window" ? (
				<AppWindowIcon size={16} className="shrink-0" />
			) : selectedSourceType === "area" ? (
				<FrameCornersIcon size={16} className="shrink-0" />
			) : selectedSourceType === "device" ? (
				<VideoCameraIcon size={16} className="shrink-0" />
			) : (
				<MonitorIcon size={16} className="shrink-0" />
			)}
			<div className="flex-1 min-w-0 flex flex-col items-start leading-[1.15]">
				<span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#90909c]">
					{selectedSourceType === "window"
						? t("recording.window")
						: selectedSourceType === "area"
							? t("recording.area", "Area")
							: selectedSourceType === "device"
								? t("recording.device", "Device")
								: t("recording.screen")}
				</span>
				<MarqueeText text={selectedSource} />
			</div>
			<CaretUpIcon
				size={10}
				className={cn(
					"text-[#6b6b78] ml-0.5 shrink-0 transition-transform duration-200",
					open ? "" : "rotate-180",
				)}
			/>
		</Button>
	);

	const { onMouseEnter } = useHudInteraction();

	const popoverHeader = (
		<div className="source-selector-header">
			<span id="source-selector-header-title" className="source-selector-header-title">
				{selectedSource}
			</span>
		</div>
	);

	return (
		<Popover open={open} onOpenChange={onOpenChange} modal={false}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent
				className="launch-theme w-80 p-0 source-selector-popover"
				unstyled
				align="start"
				sideOffset={8}
				side="top"
				alignOffset={-8}
				avoidCollisions={true}
				collisionPadding={10}
				usePortal={false}
				onMouseEnter={onMouseEnter}
				role="dialog"
				aria-labelledby="source-selector-header-title"
			>
				{popoverHeader}
				<SourceSelectorContent
					screenSources={screenSources}
					windowSources={windowSources}
					selectedSource={selectedSource}
					selectedSourceType={selectedSourceType}
					loading={loading}
					open={open}
					onSourceSelect={onSourceSelect}
					onOpenAreaSelector={onOpenAreaSelector}
				/>
			</PopoverContent>
		</Popover>
	);
});

SourceSelector.displayName = "SourceSelector";
