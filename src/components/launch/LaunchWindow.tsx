import {
	ArrowClockwiseIcon,
	CaretUpIcon,
	DotsThreeVerticalIcon,
	MicrophoneIcon,
	MicrophoneSlashIcon,
	MinusIcon,
	MonitorIcon,
	SpeakerHighIcon,
	SpeakerXIcon,
	TimerIcon,
	VideoCameraIcon,
	VideoCameraSlashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { RxDragHandleDots2 } from "react-icons/rx";
import { Separator } from "@/components/ui/separator";
import { useScopedT } from "../../contexts/I18nContext";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { useVideoDevices } from "../../hooks/useVideoDevices";
import { Button } from "../ui/button";
import { HudInteractionContext } from "./contexts/HudInteractionContext";
import { canToggleFloatingWebcamPreview } from "./floatingWebcamPreview";
import { useHudBarDrag } from "./hooks/useHudBarDrag";
import { useLaunchHudInteractionState } from "./hooks/useLaunchHudInteractionState";
import { useLaunchWindowActions } from "./hooks/useLaunchWindowActions";
import { useLaunchWindowSystemState } from "./hooks/useLaunchWindowSystemState";
import { useMicrophoneLevel } from "./hooks/useMicrophoneLevel";
import { useRecordingTimer } from "./hooks/useRecordingTimer";
import { useWebcamPreviewOverlay } from "./hooks/useWebcamPreviewOverlay";
import { resolveMicPillLabel, resolveWebcamPillLabel } from "./hudDevicePillLabels";
import styles from "./LaunchWindow.module.css";
import { CountdownPopover } from "./popovers/CountdownPopover";
import {
	LaunchPopoverCoordinatorProvider,
	useLaunchPopoverCoordinator,
} from "./popovers/LaunchPopoverCoordinator";
import { MicPopover } from "./popovers/MicPopover";
import { MorePopover } from "./popovers/MorePopover";
import { ProjectPopover } from "./popovers/ProjectPopover";
import { RecordConfirmPopover } from "./popovers/RecordConfirmPopover";
import { SourcePopover } from "./popovers/SourcePopover";
import { WebcamPopover } from "./popovers/WebcamPopover";
import { RecordingControls } from "./RecordingControls";
import { shouldConfirmMutedCameraRecording } from "./recordPreflight";
import { MarqueeText } from "./SourceSelector";
import { computeWebcamFramingLayout } from "./webcamPreviewFraming";
import { WEBCAM_PREVIEW_ANCHOR } from "./webcamPreviewPlacement";
import { computeResizeCornerInset, WEBCAM_RESIZE_HANDLE_SIZE } from "./webcamPreviewResize";
import { getWebcamPreviewShapeStyle } from "./webcamPreviewShape";

const SHOW_DEV_UPDATE_PREVIEW = import.meta.env.DEV;

export function LaunchWindow() {
	return (
		<LaunchPopoverCoordinatorProvider>
			<LaunchWindowContent />
		</LaunchPopoverCoordinatorProvider>
	);
}

function LaunchWindowContent() {
	const t = useScopedT("launch");
	const { openId, requestClose, requestOpen } = useLaunchPopoverCoordinator();

	useEffect(() => {
		const cleanup = window.electronAPI?.onHudOverlayOpenPopover?.((popoverId) => {
			requestOpen(popoverId);
		});
		return () => cleanup?.();
	}, [requestOpen]);

	const {
		recording,
		paused,
		finalizing,
		countdownActive,
		toggleRecording,
		pauseRecording,
		resumeRecording,
		cancelRecording,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		voiceEnhancementMode,
		setVoiceEnhancementMode,
		webcamEnabled,
		setWebcamEnabled,
		webcamDeviceId,
		setWebcamDeviceId,
		countdownDelay,
		setCountdownDelay,
		preparePermissions,
	} = useScreenRecorder();

	const { elapsed, formatTime } = useRecordingTimer(recording, paused);
	const hudContentRef = useRef<HTMLDivElement>(null);
	const hudBarRef = useRef<HTMLDivElement>(null);

	const {
		selectedSource,
		hasSelectedSource,
		projectLibraryEntries,
		handleSourceSelect,
		openVideoFile,
		openProjectFromLibrary,
		syncSelectedSource,
		refreshProjectLibrary,
	} = useLaunchWindowActions();

	const showWebcamControls = webcamEnabled && !recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } = useMicrophoneDevices(
		microphoneEnabled || openId === "mic",
		microphoneDeviceId,
	);
	const {
		devices: videoDevices,
		selectedDeviceId: selectedVideoDeviceId,
		setSelectedDeviceId: setSelectedVideoDeviceId,
	} = useVideoDevices(webcamEnabled || openId === "webcam", webcamDeviceId);
	const meterDeviceId =
		microphoneDeviceId ?? (selectedDeviceId === "default" ? undefined : selectedDeviceId);
	const { attachMeter } = useMicrophoneLevel({
		enabled: microphoneEnabled && !recording && !finalizing,
		deviceId: meterDeviceId,
	});
	const micPillMeterCleanupRef = useRef<() => void>();
	const attachMicPillMeter = useCallback(
		(element: HTMLDivElement | null) => {
			micPillMeterCleanupRef.current?.();
			micPillMeterCleanupRef.current = attachMeter(element);
		},
		[attachMeter],
	);

	const {
		hudOverlayMousePassthroughSupported,
		platform,
		appVersion,
		hideHudFromCapture,
		chooseRecordingsDirectory,
		toggleHudCaptureProtection,
	} = useLaunchWindowSystemState(preparePermissions);

	const supportsHudCaptureProtection = platform !== "linux";

	useEffect(() => {
		if (!selectedDeviceId) {
			return;
		}

		setMicrophoneDeviceId(selectedDeviceId === "default" ? undefined : selectedDeviceId);
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		if (
			selectedVideoDeviceId &&
			selectedVideoDeviceId !== "default" &&
			selectedVideoDeviceId !== webcamDeviceId
		) {
			setWebcamDeviceId(selectedVideoDeviceId);
		}
	}, [selectedVideoDeviceId, setWebcamDeviceId, webcamDeviceId]);

	const {
		showFloatingWebcamPreview,
		setShowFloatingWebcamPreview,
		webcamPreviewAppearance,
		updateWebcamPreviewAppearance,
		showRecordingWebcamPreview,
		webcamPreviewOffset,
		videoAspect,
		recordingWebcamPreviewContainerRef,
		isWebcamPreviewDraggingRef,
		isWebcamPreviewResizingRef,
		webcamPreviewDragStartRef,
		webcamPreviewSizePillRef,
		handleWebcamPreviewPointerDown,
		handleWebcamPreviewPointerMove,
		handleWebcamPreviewPointerUp,
		handleWebcamResizeHandlePointerDown,
		handleWebcamResizeHandlePointerMove,
		handleWebcamResizeHandlePointerUp,
		setWebcamPreviewNode,
		setRecordingWebcamPreviewNode,
	} = useWebcamPreviewOverlay({
		webcamEnabled,
		webcamDeviceId,
		showWebcamControls,
		webcamPopoverOpen: openId === "webcam",
		hudOverlayMousePassthroughSupported,
		onWebcamPreviewUnavailable: () => setWebcamEnabled(false),
	});

	const floatingWebcamFramingLayout = useMemo(
		() =>
			computeWebcamFramingLayout(
				{
					zoom: webcamPreviewAppearance.zoom,
					fitMode: "fill",
					centerX: webcamPreviewAppearance.centerX,
					centerY: webcamPreviewAppearance.centerY,
					mirror: webcamPreviewAppearance.mirror,
				},
				{
					width: webcamPreviewAppearance.size,
					height: webcamPreviewAppearance.size,
				},
				videoAspect,
			),
		[
			webcamPreviewAppearance.zoom,
			webcamPreviewAppearance.centerX,
			webcamPreviewAppearance.centerY,
			webcamPreviewAppearance.mirror,
			webcamPreviewAppearance.size,
			videoAspect,
		],
	);
	const webcamResizeHandleOffset =
		computeResizeCornerInset(webcamPreviewAppearance.size, webcamPreviewAppearance.roundness) -
		WEBCAM_RESIZE_HANDLE_SIZE / 2;

	useEffect(() => {
		window.electronAPI?.hudOverlaySetWebcamPreviewVisible?.(showRecordingWebcamPreview);
	}, [showRecordingWebcamPreview]);

	useEffect(() => {
		return () => {
			window.electronAPI?.hudOverlaySetWebcamPreviewVisible?.(false);
		};
	}, []);

	const {
		recordingHudOffset,
		isHudDragging,
		hudBarTransformRef,
		isHudDraggingRef,
		handleHudBarPointerDown,
		handleHudBarPointerMove,
		handleHudBarPointerUp,
	} = useHudBarDrag({
		hudContentRef,
		hudBarRef,
		recordingWebcamPreviewContainerRef,
	});

	const { handleHudMouseEnter, handleHudMouseLeave, beginInteractiveHudAction } =
		useLaunchHudInteractionState({
			openId,
			isHudDraggingRef,
			isWebcamPreviewDraggingRef,
			isWebcamPreviewResizingRef,
			webcamPreviewDragStartRef,
		});

	useEffect(() => {
		let mounted = true;

		void window.electronAPI.getSelectedSource().then((source) => {
			if (mounted) syncSelectedSource(source);
		});

		const cleanup = window.electronAPI.onSelectedSourceChanged((source) => {
			if (mounted) syncSelectedSource(source);
		});

		return () => {
			mounted = false;
			cleanup?.();
		};
	}, [syncSelectedSource]);

	const hudStateTransition = {
		duration: 0.24,
		ease: [0.22, 1, 0.36, 1] as const,
	};
	const micPillLabel = resolveMicPillLabel(
		devices,
		selectedDeviceId,
		microphoneDeviceId,
		microphoneEnabled,
		t("recording.microphoneOffLabel"),
		t("recording.microphoneGenericLabel"),
	);
	const webcamPillLabel = resolveWebcamPillLabel(
		videoDevices,
		selectedVideoDeviceId,
		webcamDeviceId,
		webcamEnabled,
		t("recording.webcamOffLabel"),
		t("recording.webcamGenericLabel"),
	);
	const handleRecordClick = () => {
		if (!hasSelectedSource && platform !== "linux") {
			beginInteractiveHudAction();
			requestOpen("sources");
			return;
		}

		if (shouldConfirmMutedCameraRecording({ webcamEnabled, microphoneEnabled })) {
			requestOpen("record-confirm");
			return;
		}

		toggleRecording();
	};

	const recordingControls = (
		<RecordingControls
			paused={paused}
			microphoneEnabled={microphoneEnabled}
			elapsed={elapsed}
			onToggleMicrophone={() => setMicrophoneEnabled(!microphoneEnabled)}
			onPauseResume={paused ? resumeRecording : pauseRecording}
			onStopRecording={toggleRecording}
			onHideHud={() => window.electronAPI?.hudOverlayHide?.()}
			onCancelRecording={cancelRecording}
			formatTime={formatTime}
		/>
	);

	const idleControls = (
		<>
			{platform !== "linux" && (
				<>
					<SourcePopover
						selectedSource={selectedSource}
						onSourceSelect={handleSourceSelect}
						onOpen={beginInteractiveHudAction}
						trigger={
							<Button
								variant="outline"
								size="lg"
								className={`${styles.electronNoDrag} group gap-2 px-3 min-w-0 max-w-[180px] rounded-[11px] font-medium text-[12px] shrink-0 border-[var(--launch-border)] bg-[var(--launch-surface)] text-[var(--launch-text)] hover:border-[var(--launch-border-strong)] hover:bg-[var(--launch-hover)] transition-all ${openId === "sources" ? "border-[var(--launch-border-strong)] bg-[var(--launch-hover)]" : ""}`}
								title={selectedSource}
							>
								<MonitorIcon size={16} className="shrink-0" />
								<div className="flex-1 min-w-0 overflow-hidden">
									<MarqueeText text={selectedSource} />
								</div>
								<CaretUpIcon
									size={10}
									className={`text-[#6b6b78] ml-0.5 shrink-0 transition-transform duration-200 ${
										openId === "sources" ? "" : "rotate-180"
									}`}
								/>
							</Button>
						}
					/>

					<Separator orientation="vertical" className="mx-[5px] h-6" />
				</>
			)}

			<MicPopover
				disabled={recording}
				systemAudioEnabled={systemAudioEnabled}
				onToggleSystemAudio={() => setSystemAudioEnabled(!systemAudioEnabled)}
				microphoneEnabled={microphoneEnabled}
				voiceEnhancementMode={voiceEnhancementMode}
				onVoiceEnhancementModeChange={setVoiceEnhancementMode}
				onDisableMicrophone={() => setMicrophoneEnabled(false)}
				devices={devices}
				microphoneDeviceId={microphoneDeviceId}
				selectedDeviceId={selectedDeviceId}
				attachMeter={attachMeter}
				onSelectDevice={(deviceId) => {
					setMicrophoneEnabled(true);
					setSelectedDeviceId(deviceId);
					setMicrophoneDeviceId(deviceId === "default" ? undefined : deviceId);
				}}
				trigger={
					<Button
						variant="outline"
						size="lg"
						disabled={recording}
						title={micPillLabel}
						className={`${styles.electronNoDrag} relative group gap-2 px-3 min-w-0 max-w-[172px] rounded-[11px] font-medium text-[12px] shrink-0 border-[var(--launch-border)] bg-[var(--launch-surface)] text-[var(--launch-text)] hover:border-[var(--launch-border-strong)] hover:bg-[var(--launch-hover)] transition-all ${microphoneEnabled ? "border-[var(--launch-border-strong)] bg-[var(--launch-selected)] text-[var(--launch-accent)] hover:bg-[var(--launch-selected)]" : ""} ${openId === "mic" ? "border-[var(--launch-border-strong)] bg-[var(--launch-hover)]" : ""}`}
					>
						{microphoneEnabled ? (
							<MicrophoneIcon size={16} className="shrink-0" />
						) : (
							<MicrophoneSlashIcon size={16} className="shrink-0" />
						)}
						<div className="flex-1 min-w-0 max-w-[120px] overflow-hidden">
							<MarqueeText text={micPillLabel} />
						</div>
						<CaretUpIcon
							size={10}
							className={`text-[#6b6b78] ml-0.5 shrink-0 transition-transform duration-200 ${
								openId === "mic" ? "" : "rotate-180"
							}`}
						/>
						{microphoneEnabled && (
							<div className="absolute inset-x-2 bottom-[3px] h-0.5 overflow-hidden rounded-full bg-[var(--launch-border-strong)]">
								<div
									ref={attachMicPillMeter}
									className="absolute inset-0 origin-left rounded-full bg-[var(--launch-accent)]"
									style={{ transform: "scaleX(0)" }}
								/>
							</div>
						)}
					</Button>
				}
			/>

			<Button
				variant="ghost"
				size="icon"
				iconSize="lg"
				onClick={() => setSystemAudioEnabled(!systemAudioEnabled)}
				disabled={recording}
				title={
					systemAudioEnabled
						? t("recording.disableSystemAudio")
						: t("recording.enableSystemAudio")
				}
				className={systemAudioEnabled ? styles.ibActive : ""}
			>
				{systemAudioEnabled ? <SpeakerHighIcon size={18} /> : <SpeakerXIcon size={18} />}
			</Button>

			<WebcamPopover
				disabled={recording}
				webcamEnabled={webcamEnabled}
				onDisableWebcam={() => setWebcamEnabled(false)}
				canToggleFloatingPreview={canToggleFloatingWebcamPreview(
					hudOverlayMousePassthroughSupported,
				)}
				showFloatingWebcamPreview={showFloatingWebcamPreview}
				onToggleFloatingPreview={() => setShowFloatingWebcamPreview((current) => !current)}
				showWebcamControls={showWebcamControls}
				setWebcamPreviewNode={setWebcamPreviewNode}
				previewAppearance={webcamPreviewAppearance}
				onPreviewAppearanceChange={updateWebcamPreviewAppearance}
				videoAspect={videoAspect}
				videoDevices={videoDevices}
				webcamDeviceId={webcamDeviceId}
				selectedVideoDeviceId={selectedVideoDeviceId}
				onSelectVideoDevice={(deviceId) => {
					setWebcamEnabled(true);
					setSelectedVideoDeviceId(deviceId);
					setWebcamDeviceId(deviceId);
				}}
				trigger={
					<Button
						variant="outline"
						size="lg"
						disabled={recording}
						title={webcamPillLabel}
						className={`${styles.electronNoDrag} group gap-2 px-3 min-w-0 max-w-[172px] rounded-[11px] font-medium text-[12px] shrink-0 border-[var(--launch-border)] bg-[var(--launch-surface)] text-[var(--launch-text)] hover:border-[var(--launch-border-strong)] hover:bg-[var(--launch-hover)] transition-all ${webcamEnabled ? "border-[var(--launch-border-strong)] bg-[var(--launch-selected)] text-[var(--launch-accent)] hover:bg-[var(--launch-selected)]" : ""} ${openId === "webcam" ? "border-[var(--launch-border-strong)] bg-[var(--launch-hover)]" : ""}`}
					>
						{webcamEnabled ? (
							<VideoCameraIcon size={16} className="shrink-0" />
						) : (
							<VideoCameraSlashIcon size={16} className="shrink-0" />
						)}
						<div className="flex-1 min-w-0 max-w-[120px] overflow-hidden">
							<MarqueeText text={webcamPillLabel} />
						</div>
						<CaretUpIcon
							size={10}
							className={`text-[#6b6b78] ml-0.5 shrink-0 transition-transform duration-200 ${
								openId === "webcam" ? "" : "rotate-180"
							}`}
						/>
					</Button>
				}
			/>

			<CountdownPopover
				countdownDelay={countdownDelay}
				onSelectDelay={setCountdownDelay}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						title={t("recording.countdownDelay")}
						className={countdownDelay > 0 ? styles.ibActive : ""}
					>
						<TimerIcon size={18} />
					</Button>
				}
			/>

			<RecordConfirmPopover
				onRecordAnyway={toggleRecording}
				trigger={
					<button
						type="button"
						className={`${styles.recBtn} ${styles.electronNoDrag}`}
						onClick={handleRecordClick}
						disabled={countdownActive}
						title={t("recording.record")}
					>
						<div className={styles.recDot} />
					</button>
				}
			/>

			<Separator orientation="vertical" className="mx-[5px] h-6" />

			<div className="relative w-0 h-0">
				<ProjectPopover
					entries={projectLibraryEntries}
					onOpenProject={openProjectFromLibrary}
					trigger={<div className="absolute inset-0 pointer-events-none opacity-0" />}
				/>
			</div>

			<MorePopover
				supportsHudCaptureProtection={supportsHudCaptureProtection}
				hideHudFromCapture={hideHudFromCapture}
				onToggleHudCaptureProtection={() => {
					void toggleHudCaptureProtection();
				}}
				onChooseRecordingsDirectory={() => {
					void chooseRecordingsDirectory();
				}}
				onOpenVideoFile={() => {
					void openVideoFile();
				}}
				onOpenProjectBrowser={() => {
					refreshProjectLibrary().then(() => {
						requestOpen("projects");
					});
				}}
				showDevUpdatePreview={SHOW_DEV_UPDATE_PREVIEW}
				onPreviewUpdateUi={() => {
					if (openId) requestClose(openId);
					void window.electronAPI.previewUpdateToast().catch((error) => {
						console.warn("Failed to preview update toast:", error);
					});
				}}
				appVersion={appVersion}
				trigger={
					<Button variant="ghost" size="icon" iconSize="lg" title={t("recording.more")}>
						<DotsThreeVerticalIcon size={18} />
					</Button>
				}
			/>

			<Button
				variant="ghost"
				size="icon"
				iconSize="lg"
				onClick={() => window.electronAPI?.hudOverlayHide?.()}
				title={t("recording.hideHud")}
			>
				<MinusIcon size={16} />
			</Button>

			<Button
				variant="ghost"
				size="icon"
				iconSize="lg"
				onClick={() => window.electronAPI?.hudOverlayClose?.()}
				title={t("recording.closeApp")}
			>
				<XIcon size={16} />
			</Button>
		</>
	);

	const finalizingControls = (
		<div className={styles.finalizingState}>
			<ArrowClockwiseIcon size={15} className={styles.finalizingSpin} />
			<div className={styles.finalizingCopy}>
				<span>{t("recording.preparing", "Preparing recording")}</span>
				<small>{t("recording.preparingSubtitle", "Opening the editor in a moment")}</small>
			</div>
		</div>
	);

	const hudMode = finalizing ? "finalizing" : recording ? "recording" : "idle";
	const useNativeHudBarDrag =
		platform === "linux" || hudOverlayMousePassthroughSupported === false;

	return (
		<HudInteractionContext.Provider
			value={{ onMouseEnter: handleHudMouseEnter, onMouseLeave: handleHudMouseLeave }}
		>
			<div
				className="w-full flex justify-center bg-transparent overflow-visible items-end pb-5 pointer-events-none"
				style={{ height: "100vh" }}
			>
				<div
					ref={hudContentRef}
					className="flex items-center overflow-visible flex-col-reverse pointer-events-none"
				>
					<div
						className="flex flex-col items-center pointer-events-auto p-2"
						onMouseEnter={handleHudMouseEnter}
						onMouseLeave={handleHudMouseLeave}
					>
						<div
							ref={hudBarTransformRef}
							style={{
								transform: `translate3d(${recordingHudOffset.x}px, ${recordingHudOffset.y}px, 0)`,
							}}
						>
							<motion.div
								ref={hudBarRef}
								layout={!showRecordingWebcamPreview && !isHudDragging}
								transition={hudStateTransition}
								className={`${styles.bar} launch-theme mb-2`}
							>
								<div
									// Linux compositors and non-passthrough Windows fallback windows
									// need native window dragging; the JS drag path only translates
									// content inside the HUD window.
									className={`flex items-center px-0.5 cursor-grab active:cursor-grabbing ${
										useNativeHudBarDrag ? styles.electronDrag : ""
									}`}
									onPointerDown={handleHudBarPointerDown}
									onPointerMove={handleHudBarPointerMove}
									onPointerUp={handleHudBarPointerUp}
									onPointerCancel={handleHudBarPointerUp}
								>
									<RxDragHandleDots2 size={14} className="text-[#6b6b78]" />
								</div>

								<div className={styles.barStateViewport}>
									<AnimatePresence initial={false} mode="wait">
										<motion.div
											key={hudMode}
											layout={!showRecordingWebcamPreview && !isHudDragging}
											className={styles.barState}
											initial={{
												opacity: 0,
												y: 10,
												scale: 0.985,
												filter: "blur(8px)",
											}}
											animate={{
												opacity: 1,
												y: 0,
												scale: 1,
												filter: "blur(0px)",
											}}
											exit={{
												opacity: 0,
												y: -10,
												scale: 0.985,
												filter: "blur(6px)",
											}}
											transition={hudStateTransition}
										>
											{finalizing
												? finalizingControls
												: recording
													? recordingControls
													: idleControls}
										</motion.div>
									</AnimatePresence>
								</div>
							</motion.div>
						</div>
						{showRecordingWebcamPreview && (
							<div
								ref={recordingWebcamPreviewContainerRef}
								className={`${styles.webcamPreviewShell} ${styles.electronNoDrag} pointer-events-auto`}
								data-hud-interactive
								title={t("recording.webcam")}
								style={{
									right: WEBCAM_PREVIEW_ANCHOR.right,
									bottom: WEBCAM_PREVIEW_ANCHOR.bottom,
									transform: `translate(${webcamPreviewOffset.x}px, ${webcamPreviewOffset.y}px)`,
									width: webcamPreviewAppearance.size,
									height: webcamPreviewAppearance.size,
								}}
								onMouseEnter={handleHudMouseEnter}
								onMouseLeave={handleHudMouseLeave}
								onPointerDown={handleWebcamPreviewPointerDown}
								onPointerMove={handleWebcamPreviewPointerMove}
								onPointerUp={handleWebcamPreviewPointerUp}
								onPointerCancel={handleWebcamPreviewPointerUp}
							>
								<div
									className={styles.webcamPreviewClip}
									style={getWebcamPreviewShapeStyle(
										webcamPreviewAppearance.roundness,
									)}
								>
									<video
										ref={setRecordingWebcamPreviewNode}
										className={styles.webcamPreviewFrame}
										muted
										playsInline
										style={{
											left: floatingWebcamFramingLayout.video.left,
											top: floatingWebcamFramingLayout.video.top,
											width: floatingWebcamFramingLayout.video.width,
											height: floatingWebcamFramingLayout.video.height,
											transform: webcamPreviewAppearance.mirror
												? "scaleX(-1)"
												: undefined,
										}}
									/>
								</div>
								<div
									className={`${styles.webcamResizeHandle} ${styles.webcamResizeHandleTopLeft}`}
									style={{
										left: webcamResizeHandleOffset,
										top: webcamResizeHandleOffset,
									}}
									onPointerDown={handleWebcamResizeHandlePointerDown("top-left")}
									onPointerMove={handleWebcamResizeHandlePointerMove}
									onPointerUp={handleWebcamResizeHandlePointerUp}
									onPointerCancel={handleWebcamResizeHandlePointerUp}
								/>
								<div
									className={`${styles.webcamResizeHandle} ${styles.webcamResizeHandleTopRight}`}
									style={{
										right: webcamResizeHandleOffset,
										top: webcamResizeHandleOffset,
									}}
									onPointerDown={handleWebcamResizeHandlePointerDown("top-right")}
									onPointerMove={handleWebcamResizeHandlePointerMove}
									onPointerUp={handleWebcamResizeHandlePointerUp}
									onPointerCancel={handleWebcamResizeHandlePointerUp}
								/>
								<div
									className={`${styles.webcamResizeHandle} ${styles.webcamResizeHandleBottomLeft}`}
									style={{
										left: webcamResizeHandleOffset,
										bottom: webcamResizeHandleOffset,
									}}
									onPointerDown={handleWebcamResizeHandlePointerDown(
										"bottom-left",
									)}
									onPointerMove={handleWebcamResizeHandlePointerMove}
									onPointerUp={handleWebcamResizeHandlePointerUp}
									onPointerCancel={handleWebcamResizeHandlePointerUp}
								/>
								<div
									className={`${styles.webcamResizeHandle} ${styles.webcamResizeHandleBottomRight}`}
									style={{
										right: webcamResizeHandleOffset,
										bottom: webcamResizeHandleOffset,
									}}
									onPointerDown={handleWebcamResizeHandlePointerDown(
										"bottom-right",
									)}
									onPointerMove={handleWebcamResizeHandlePointerMove}
									onPointerUp={handleWebcamResizeHandlePointerUp}
									onPointerCancel={handleWebcamResizeHandlePointerUp}
								/>
								<div
									ref={webcamPreviewSizePillRef}
									className={styles.webcamSizePill}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</HudInteractionContext.Provider>
	);
}
