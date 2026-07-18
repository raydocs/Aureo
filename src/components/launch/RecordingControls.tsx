import {
	MicrophoneIcon,
	MicrophoneSlashIcon,
	PauseIcon,
	PlayIcon,
	Trash as TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useScopedT } from "@/contexts/I18nContext";
import styles from "./LaunchWindow.module.css";

interface RecordingControlsProps {
	paused: boolean;
	microphoneEnabled: boolean;
	elapsed: number;
	onToggleMicrophone: () => void;
	onPauseResume: () => void;
	onStopRecording: () => void;
	onCancelRecording: () => void;
	onHideHud: () => void;
	formatTime: (seconds: number) => string;
}

export const RecordingControls = ({
	paused,
	microphoneEnabled,
	elapsed,
	onToggleMicrophone,
	onPauseResume,
	onStopRecording,
	onCancelRecording,
	onHideHud,
	formatTime,
}: RecordingControlsProps) => {
	const t = useScopedT("launch");

	const memoizedControls = useMemo(() => {
		return (
			<>
				<div
					className={styles.barGroup}
					role="group"
					aria-label={paused ? t("recording.paused") : t("recording.rec")}
				>
					<div
						className={`${styles.recStatusDot} ${
							paused ? styles.recStatusDotPaused : styles.recStatusDotBlink
						}`}
						aria-hidden="true"
					/>
					<span
						className={`text-[10px] font-bold tracking-[0.06em] ${
							paused ? "text-[#fbbf24]" : "text-[#f43f5e]"
						}`}
					>
						{paused ? t("recording.paused") : t("recording.rec")}
					</span>
					<span
						className={`font-mono text-xs font-semibold min-w-[52px] text-center tracking-[0.02em] ${
							paused ? "text-[#fbbf24]" : "text-[var(--launch-text)]"
						}`}
						aria-live="polite"
						aria-atomic="true"
					>
						{formatTime(elapsed)}
					</span>
				</div>

				<div
					className={styles.barGroup}
					role="group"
					aria-label={t("recording.microphone")}
				>
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						className={microphoneEnabled ? styles.ibActive : styles.ib}
						onClick={onToggleMicrophone}
						title={t("recording.micToggleDisabledTip")}
						aria-label={t("recording.micToggleDisabledTip")}
						aria-pressed={microphoneEnabled}
						disabled
					>
						{microphoneEnabled ? (
							<MicrophoneIcon size={18} />
						) : (
							<MicrophoneSlashIcon size={18} />
						)}
					</Button>
				</div>

				<div className={styles.barGroup} role="group" aria-label={t("recording.pause")}>
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						onClick={onPauseResume}
						title={paused ? t("recording.resume") : t("recording.pause")}
						aria-label={paused ? t("recording.resume") : t("recording.pause")}
						aria-pressed={paused}
						className={paused ? styles.ibGreen : styles.ib}
					>
						{paused ? (
							<PlayIcon size={18} fill="currentColor" strokeWidth={0} />
						) : (
							<PauseIcon size={18} />
						)}
					</Button>
				</div>

				<div className={styles.barGroup} role="group" aria-label={t("recording.stop")}>
					<button
						type="button"
						className={styles.stopBtn}
						onClick={onStopRecording}
						title={t("recording.stop")}
						aria-label={t("recording.stop")}
					>
						<span className={styles.stopBtnSquare} aria-hidden="true" />
						<span>{t("recording.stop")}</span>
					</button>
				</div>

				<div className={styles.barGroup} role="group" aria-label={t("recording.cancel")}>
					<button
						type="button"
						className={styles.cancelBtn}
						onClick={onCancelRecording}
						title={t("recording.cancel")}
						aria-label={t("recording.cancel")}
					>
						<TrashIcon size={14} aria-hidden="true" />
						<span>{t("recording.cancel")}</span>
					</button>
				</div>

				<div className={styles.sep} role="separator" aria-orientation="vertical" />

				<div className={styles.barGroup} role="group" aria-label={t("recording.hideHud")}>
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						onClick={onHideHud}
						title={t("recording.hideHud")}
						aria-label={t("recording.hideHud")}
						className={styles.ib}
					>
						<XIcon size={18} />
					</Button>
				</div>
			</>
		);
	}, [
		paused,
		microphoneEnabled,
		elapsed,
		onToggleMicrophone,
		onPauseResume,
		onStopRecording,
		onCancelRecording,
		onHideHud,
		formatTime,
		t,
	]);

	return memoizedControls;
};
