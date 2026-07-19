import {
	Eye,
	EyeSlash as EyeOff,
	FlipHorizontal,
	VideoCamera as Video,
	VideoCameraSlash as VideoOff,
} from "@phosphor-icons/react";
import {
	type ReactElement,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import { useScopedT } from "@/contexts/I18nContext";
import type { WebcamPreviewAppearance } from "../webcamPreviewAppearance";
import { WEBCAM_PREVIEW_ZOOM_RANGE } from "../webcamPreviewAppearance";
import {
	applyWebcamFramingDrag,
	computeWebcamFramingLayout,
	type WebcamFramingLayout,
} from "../webcamPreviewFraming";
import { WEBCAM_PREVIEW_SHAPE_PRESETS, WEBCAM_PREVIEW_SIZE_PRESETS } from "../webcamPreviewPresets";
import { getWebcamPreviewShapeStyle } from "../webcamPreviewShape";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";
import type { DeviceOption } from "./launchPopoverTypes";
import { DropdownItem, HudPopover } from "./PopoverScaffold";

const POPOVER_ID = "webcam";
const THUMBNAIL_SIZE = 96;
const FRAME_TRANSITION =
	"left 180ms cubic-bezier(0.22, 1, 0.36, 1), top 180ms cubic-bezier(0.22, 1, 0.36, 1), width 180ms cubic-bezier(0.22, 1, 0.36, 1), height 180ms cubic-bezier(0.22, 1, 0.36, 1)";

export function WebcamPopover({
	trigger,
	disabled,
	webcamEnabled,
	onDisableWebcam,
	canToggleFloatingPreview,
	showFloatingWebcamPreview,
	onToggleFloatingPreview,
	showWebcamControls,
	setWebcamPreviewNode,
	previewAppearance,
	onPreviewAppearanceChange,
	videoAspect,
	videoDevices,
	webcamDeviceId,
	selectedVideoDeviceId,
	onSelectVideoDevice,
}: {
	trigger: ReactElement;
	disabled?: boolean;
	webcamEnabled: boolean;
	onDisableWebcam: () => void;
	canToggleFloatingPreview: boolean;
	showFloatingWebcamPreview: boolean;
	onToggleFloatingPreview: () => void;
	showWebcamControls: boolean;
	setWebcamPreviewNode: (node: HTMLVideoElement | null) => void;
	previewAppearance: WebcamPreviewAppearance;
	onPreviewAppearanceChange: (patch: Partial<WebcamPreviewAppearance>) => void;
	videoAspect: number;
	videoDevices: DeviceOption[];
	webcamDeviceId?: string;
	selectedVideoDeviceId?: string;
	onSelectVideoDevice: (deviceId: string) => void;
}) {
	const t = useScopedT("launch");
	const { isOpen, requestOpen, requestClose } = useLaunchPopoverCoordinator();
	const open = isOpen(POPOVER_ID);
	const sizePresetLabels = {
		small: t("recording.webcamPreviewSizeSmall", "Small"),
		medium: t("recording.webcamPreviewSizeMedium", "Medium"),
		large: t("recording.webcamPreviewSizeLarge", "Large"),
	};
	const sizePresetShortLabels = { small: "S", medium: "M", large: "L" };
	const shapePresetLabels = {
		circle: t("recording.webcamShapeCircle", "Circle"),
		rounded: t("recording.webcamShapeRounded", "Rounded"),
		square: t("recording.webcamShapeSquare", "Square"),
	};

	const [draftCenter, setDraftCenter] = useState<{
		centerX: number;
		centerY: number;
	} | null>(null);
	const framingDragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		startCenterX: number;
		startCenterY: number;
		layoutAtStart: WebcamFramingLayout;
	} | null>(null);
	const draftCenterRef = useRef(draftCenter);
	draftCenterRef.current = draftCenter;

	const effectiveCenterX = draftCenter?.centerX ?? previewAppearance.centerX;
	const effectiveCenterY = draftCenter?.centerY ?? previewAppearance.centerY;
	const isFramingDragging = draftCenter !== null;

	const thumbnailFramingLayout = useMemo(
		() =>
			computeWebcamFramingLayout(
				{
					zoom: previewAppearance.zoom,
					fitMode: "fill",
					centerX: effectiveCenterX,
					centerY: effectiveCenterY,
					mirror: previewAppearance.mirror,
				},
				{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE },
				videoAspect,
			),
		[
			previewAppearance.zoom,
			effectiveCenterX,
			effectiveCenterY,
			previewAppearance.mirror,
			videoAspect,
		],
	);

	const isPannable = thumbnailFramingLayout.pannableX || thumbnailFramingLayout.pannableY;

	const handleFramingPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}

			const layout = computeWebcamFramingLayout(
				{
					zoom: previewAppearance.zoom,
					fitMode: "fill",
					centerX: previewAppearance.centerX,
					centerY: previewAppearance.centerY,
					mirror: previewAppearance.mirror,
				},
				{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE },
				videoAspect,
			);
			if (!layout.pannableX && !layout.pannableY) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			event.currentTarget.setPointerCapture(event.pointerId);
			framingDragRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				startCenterX: previewAppearance.centerX,
				startCenterY: previewAppearance.centerY,
				layoutAtStart: layout,
			};
			setDraftCenter({
				centerX: previewAppearance.centerX,
				centerY: previewAppearance.centerY,
			});
		},
		[
			previewAppearance.zoom,
			previewAppearance.centerX,
			previewAppearance.centerY,
			previewAppearance.mirror,
			videoAspect,
		],
	);

	const handleFramingPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const drag = framingDragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) {
				return;
			}

			const next = applyWebcamFramingDrag(
				drag.layoutAtStart,
				{
					x: event.clientX - drag.startX,
					y: event.clientY - drag.startY,
				},
				{
					zoom: previewAppearance.zoom,
					fitMode: "fill",
					centerX: drag.startCenterX,
					centerY: drag.startCenterY,
					mirror: previewAppearance.mirror,
				},
			);
			setDraftCenter(next);
		},
		[previewAppearance.zoom, previewAppearance.mirror],
	);

	const endFramingDrag = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const drag = framingDragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) {
				return;
			}

			framingDragRef.current = null;
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}

			const draft = draftCenterRef.current;
			setDraftCenter(null);
			if (draft) {
				onPreviewAppearanceChange({
					centerX: draft.centerX,
					centerY: draft.centerY,
				});
			}
		},
		[onPreviewAppearanceChange],
	);

	const handleFramingDoubleClick = useCallback(() => {
		if (framingDragRef.current) {
			return;
		}
		onPreviewAppearanceChange({ centerX: 0.5, centerY: 0.5 });
	}, [onPreviewAppearanceChange]);

	const showResetFraming =
		previewAppearance.centerX !== 0.5 ||
		previewAppearance.centerY !== 0.5 ||
		previewAppearance.zoom !== 1;

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
			role="dialog"
			aria-label={t("recording.webcam")}
			trigger={trigger}
			align="center"
		>
			<div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--launch-label)]">
				{t("recording.webcam")}
			</div>
			{webcamEnabled && (
				<>
					<DropdownItem
						icon={<VideoOff size={16} />}
						onClick={() => {
							onDisableWebcam();
							requestClose(POPOVER_ID);
						}}
					>
						{t("recording.turnOffWebcam")}
					</DropdownItem>
					{canToggleFloatingPreview ? (
						<DropdownItem
							role="menuitemcheckbox"
							icon={
								showFloatingWebcamPreview ? <EyeOff size={16} /> : <Eye size={16} />
							}
							selected={showFloatingWebcamPreview}
							onClick={onToggleFloatingPreview}
						>
							{showFloatingWebcamPreview
								? t("recording.hideFloatingWebcamPreview")
								: t("recording.showFloatingWebcamPreview")}
						</DropdownItem>
					) : null}
					<DropdownItem
						role="menuitemcheckbox"
						icon={<FlipHorizontal size={16} />}
						selected={previewAppearance.mirror}
						onClick={() =>
							onPreviewAppearanceChange({ mirror: !previewAppearance.mirror })
						}
					>
						{t("recording.webcamPreviewMirror", "Mirror camera")}
					</DropdownItem>
				</>
			)}
			{!webcamEnabled && (
				<div className="px-3 py-2 text-xs text-[var(--launch-text-muted)]">
					{t("recording.selectWebcamToEnable")}
				</div>
			)}
			{showWebcamControls && (
				<div className="flex flex-col items-center px-3 py-2">
					<div
						className="relative h-24 w-24 overflow-hidden bg-[var(--launch-hover)] ring-1 ring-[var(--launch-border-strong)]"
						style={{
							...getWebcamPreviewShapeStyle(previewAppearance.roundness),
							cursor: isPannable
								? isFramingDragging
									? "grabbing"
									: "grab"
								: "default",
							touchAction: "none",
						}}
						onPointerDown={handleFramingPointerDown}
						onPointerMove={handleFramingPointerMove}
						onPointerUp={endFramingDrag}
						onPointerCancel={endFramingDrag}
						onDoubleClick={handleFramingDoubleClick}
					>
						<video
							ref={setWebcamPreviewNode}
							muted
							playsInline
							style={{
								position: "absolute",
								// Tailwind preflight clamps video to max-width:100%; undo it so
								// the explicit framing box keeps its true aspect.
								maxWidth: "none",
								maxHeight: "none",
								objectFit: "cover",
								transformOrigin: "center",
								left: thumbnailFramingLayout.video.left,
								top: thumbnailFramingLayout.video.top,
								width: thumbnailFramingLayout.video.width,
								height: thumbnailFramingLayout.video.height,
								transform: previewAppearance.mirror ? "scaleX(-1)" : undefined,
								transition: isFramingDragging ? undefined : FRAME_TRANSITION,
								pointerEvents: "none",
							}}
						/>
					</div>
					{showResetFraming ? (
						<button
							type="button"
							className="mt-1.5 text-[10px] text-[var(--launch-text-muted)] hover:text-[var(--launch-text)] transition-colors"
							onClick={() =>
								onPreviewAppearanceChange({
									centerX: 0.5,
									centerY: 0.5,
									zoom: 1,
								})
							}
						>
							{t("recording.webcamPreviewResetFraming", "Reset framing")}
						</button>
					) : null}
				</div>
			)}
			{webcamEnabled && (
				<div className="border-y border-[var(--launch-border)] px-3 py-2.5">
					<SegmentedRow
						label={t("recording.webcamPreviewSizePresets", "Size")}
						options={WEBCAM_PREVIEW_SIZE_PRESETS.map((preset) => ({
							id: preset.id,
							label: sizePresetShortLabels[preset.id],
							accessibleLabel: sizePresetLabels[preset.id],
							selected: previewAppearance.size === preset.size,
							onClick: () => onPreviewAppearanceChange({ size: preset.size }),
						}))}
					/>
					<SegmentedRow
						label={t("recording.webcamPreviewShape", "Shape")}
						options={WEBCAM_PREVIEW_SHAPE_PRESETS.map((preset) => ({
							id: preset.id,
							label: shapePresetLabels[preset.id],
							accessibleLabel: shapePresetLabels[preset.id],
							selected: previewAppearance.roundness === preset.roundness,
							onClick: () =>
								onPreviewAppearanceChange({ roundness: preset.roundness }),
						}))}
					/>
					<WebcamPreviewSlider
						label={t("recording.webcamPreviewSize", "Preview size")}
						valueLabel={`${previewAppearance.size}px`}
						min={144}
						max={320}
						step={8}
						value={previewAppearance.size}
						onChange={(size) => onPreviewAppearanceChange({ size })}
					/>
					<WebcamPreviewSlider
						label={t("recording.webcamPreviewRoundness", "Roundness")}
						valueLabel={`${previewAppearance.roundness}%`}
						min={0}
						max={100}
						step={5}
						value={previewAppearance.roundness}
						onChange={(roundness) => onPreviewAppearanceChange({ roundness })}
					/>
					<WebcamPreviewSlider
						label={t("recording.webcamPreviewZoom", "Framing zoom")}
						valueLabel={`${Math.round(previewAppearance.zoom * 100)}%`}
						min={Math.round(WEBCAM_PREVIEW_ZOOM_RANGE.min * 100)}
						max={Math.round(WEBCAM_PREVIEW_ZOOM_RANGE.max * 100)}
						step={5}
						value={Math.round(previewAppearance.zoom * 100)}
						onChange={(zoom) => onPreviewAppearanceChange({ zoom: zoom / 100 })}
					/>
				</div>
			)}
			{videoDevices.map((device) => (
				<DropdownItem
					key={device.deviceId}
					role="menuitemradio"
					icon={
						webcamEnabled &&
						(webcamDeviceId === device.deviceId ||
							selectedVideoDeviceId === device.deviceId) ? (
							<Video size={16} />
						) : (
							<VideoOff size={16} />
						)
					}
					selected={
						webcamEnabled &&
						(webcamDeviceId === device.deviceId ||
							selectedVideoDeviceId === device.deviceId)
					}
					onClick={() => onSelectVideoDevice(device.deviceId)}
				>
					{device.label}
				</DropdownItem>
			))}
			{videoDevices.length === 0 && (
				<div className="text-center text-xs text-[var(--launch-text-muted)] py-4">
					{t("recording.noWebcamsFound")}
				</div>
			)}
		</HudPopover>
	);
}

function SegmentedRow({
	label,
	options,
}: {
	label: string;
	options: Array<{
		id: string;
		label: string;
		accessibleLabel: string;
		selected: boolean;
		onClick: () => void;
	}>;
}) {
	return (
		<div className="mb-2 flex items-center justify-between gap-4 text-[11px]">
			<span className="text-[var(--launch-text-muted)]">{label}</span>
			<div className="flex items-center gap-0.5">
				{options.map((option) => (
					<button
						key={option.id}
						type="button"
						aria-label={option.accessibleLabel}
						aria-pressed={option.selected}
						title={option.accessibleLabel}
						className={`min-w-7 rounded-[8px] px-2 py-1 text-[11px] transition-colors ${
							option.selected
								? "bg-[var(--launch-selected)] text-[var(--launch-text)]"
								: "text-[var(--launch-text-muted)] hover:bg-[var(--launch-hover)]"
						}`}
						onClick={option.onClick}
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	);
}

function WebcamPreviewSlider({
	label,
	valueLabel,
	min,
	max,
	step,
	value,
	onChange,
}: {
	label: string;
	valueLabel: string;
	min: number;
	max: number;
	step: number;
	value: number;
	onChange: (value: number) => void;
}) {
	return (
		<label className="mb-2 block last:mb-0">
			<span className="mb-1 flex items-center justify-between gap-4 text-[11px] text-[var(--launch-text-muted)]">
				<span>{label}</span>
				<span className="tabular-nums text-[var(--launch-text)]">{valueLabel}</span>
			</span>
			<input
				type="range"
				className="block h-4 w-full cursor-pointer accent-[var(--launch-accent)]"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(Number(event.currentTarget.value))}
			/>
		</label>
	);
}
