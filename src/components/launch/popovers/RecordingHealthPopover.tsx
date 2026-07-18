import {
	CheckCircleIcon,
	HardDrivesIcon,
	MicrophoneIcon,
	MonitorIcon,
	ProhibitIcon,
	QuestionIcon,
	WarningCircleIcon,
	WaveformIcon,
} from "@phosphor-icons/react";
import { type ReactElement } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import type { MicrophoneInputStatus } from "../hooks/useMicrophoneLevel";
import { formatAvailableStorage, type RecordingHealthSnapshot } from "../hooks/useRecordingHealth";
import styles from "../LaunchWindow.module.css";
import { useLaunchPopoverCoordinator } from "./LaunchPopoverCoordinator";
import type { CaptureSourceType } from "./launchPopoverTypes";
import { HudPopover } from "./PopoverScaffold";
import popoverStyles from "./RecordingHealthPopover.module.css";

const POPOVER_ID = "recording-health";

type HealthSeverity = "success" | "warning" | "error" | "neutral" | "unknown";

export interface HealthRowModel {
	id: string;
	icon: "microphone" | "system-audio" | "camera" | "disk" | "permissions";
	label: string;
	value: string;
	severity: HealthSeverity;
}

export interface RecordingHealthPopoverProps {
	trigger: ReactElement;
	disabled?: boolean;
	health: RecordingHealthSnapshot | null;
	loading: boolean;
	microphoneEnabled: boolean;
	microphoneInputStatus: MicrophoneInputStatus;
	systemAudioEnabled: boolean;
	selectedSourceType: CaptureSourceType | null;
	cameraDeviceCount: number;
	cameraDevicesLoading: boolean;
}

export function resolveRecordingHealthRows({
	t,
	health,
	loading,
	microphoneEnabled,
	microphoneInputStatus,
	systemAudioEnabled,
	selectedSourceType,
	cameraDeviceCount,
	cameraDevicesLoading,
}: {
	t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string;
	health: RecordingHealthSnapshot | null;
	loading: boolean;
	microphoneEnabled: boolean;
	microphoneInputStatus: MicrophoneInputStatus;
	systemAudioEnabled: boolean;
	selectedSourceType: CaptureSourceType | null;
	cameraDeviceCount: number;
	cameraDevicesLoading: boolean;
}): HealthRowModel[] {
	const rows: HealthRowModel[] = [];

	// Microphone input row
	let micSeverity: HealthSeverity = "neutral";
	let micValue: string;
	if (!microphoneEnabled) {
		micValue = t("health.microphoneOff", "Off");
		micSeverity = "neutral";
	} else if (
		health?.permissions.microphone === "denied" ||
		health?.permissions.microphone === "restricted"
	) {
		micValue = t("health.microphoneAccessDenied", "Microphone access denied");
		micSeverity = "error";
	} else {
		switch (microphoneInputStatus) {
			case "checking":
				micValue = t("health.microphoneChecking", "Checking microphone...");
				micSeverity = "unknown";
				break;
			case "error":
				micValue = t("health.microphoneError", "Microphone unavailable");
				micSeverity = "error";
				break;
			case "silent":
				micValue = t("health.microphoneSilent", "No input detected");
				micSeverity = "warning";
				break;
			case "active":
				micValue = t("health.microphoneActive", "Active");
				micSeverity = "success";
				break;
			case "off":
			default:
				micValue = t("health.microphoneOff", "Off");
				micSeverity = "neutral";
		}
	}
	rows.push({
		id: "microphone",
		icon: "microphone",
		label: t("health.microphoneInput", "Microphone input"),
		value: micValue,
		severity: micSeverity,
	});

	// System audio row
	let systemAudioSeverity: HealthSeverity = "neutral";
	let systemAudioValue: string;
	if (selectedSourceType === "device") {
		systemAudioValue = t("health.systemAudioUnavailable", "Unavailable for device capture");
		systemAudioSeverity = "warning";
	} else if (!systemAudioEnabled) {
		systemAudioValue = t("health.systemAudioOff", "Off");
		systemAudioSeverity = "neutral";
	} else if (health) {
		if (health.systemAudio.available) {
			systemAudioValue = t("health.systemAudioAvailable", "Available");
			systemAudioSeverity = "success";
		} else if (health.systemAudio.supported) {
			systemAudioValue = t("health.systemAudioUnavailable", "Unavailable");
			systemAudioSeverity = "warning";
		} else {
			systemAudioValue = t("health.systemAudioUnsupported", "Unsupported");
			systemAudioSeverity = "warning";
		}
	} else {
		systemAudioValue = t("health.systemAudioUnknown", "Unknown");
		systemAudioSeverity = "unknown";
	}
	rows.push({
		id: "system-audio",
		icon: "system-audio",
		label: t("health.systemAudio", "System audio"),
		value: systemAudioValue,
		severity: systemAudioSeverity,
	});

	// Camera row
	let cameraSeverity: HealthSeverity = "neutral";
	let cameraValue: string;
	if (health?.permissions.camera === "denied" || health?.permissions.camera === "restricted") {
		cameraValue = t("health.cameraAccessDenied", "Camera access denied");
		cameraSeverity = "error";
	} else if (cameraDevicesLoading) {
		cameraValue = t("health.cameraChecking", "Checking camera...");
		cameraSeverity = "unknown";
	} else if (cameraDeviceCount === 0) {
		cameraValue = t("health.cameraNotFound", "No camera found");
		cameraSeverity = "warning";
	} else {
		cameraValue = t(
			"health.cameraAvailable",
			cameraDeviceCount === 1 ? "Available (1 device)" : "Available ({{count}} devices)",
			{ count: cameraDeviceCount },
		);
		cameraSeverity = "success";
	}
	rows.push({
		id: "camera",
		icon: "camera",
		label: t("health.camera", "Camera"),
		value: cameraValue,
		severity: cameraSeverity,
	});

	// Disk space row
	let diskSeverity: HealthSeverity = "unknown";
	let diskValue: string;
	if (loading || !health) {
		diskValue = t("health.diskChecking", "Checking disk space...");
		diskSeverity = "unknown";
	} else {
		diskValue = formatAvailableStorage(health.storage.freeBytes);
		switch (health.storage.status) {
			case "low":
				diskSeverity = "error";
				break;
			case "unknown":
				diskSeverity = "unknown";
				break;
			case "ok":
			default:
				diskSeverity = "success";
				break;
		}
	}
	rows.push({
		id: "disk",
		icon: "disk",
		label: t("health.diskSpace", "Disk space"),
		value: diskValue,
		severity: diskSeverity,
	});

	// Permissions summary row
	const blockedPermissions: string[] = [];
	const pendingPermissions: string[] = [];
	const unknownPermissions: string[] = [];
	if (health) {
		const permissionEntries = [
			[health.permissions.screen, t("health.permissionScreen", "Screen")],
			[health.permissions.microphone, t("health.permissionMicrophone", "Microphone")],
			[health.permissions.camera, t("health.permissionCamera", "Camera")],
		] as const;

		for (const [status, label] of permissionEntries) {
			if (status === "denied" || status === "restricted") {
				blockedPermissions.push(label);
			} else if (status === "not-determined") {
				pendingPermissions.push(label);
			} else if (status === "unknown") {
				unknownPermissions.push(label);
			}
		}
	}

	let permissionsSeverity: HealthSeverity = "success";
	let permissionsValue: string;
	if (!health) {
		permissionsValue = t("health.permissionsUnknown", "Unknown");
		permissionsSeverity = "unknown";
	} else if (blockedPermissions.length > 0) {
		permissionsValue = t("health.permissionsBlocked", "Blocked: {{permissions}}", {
			permissions: blockedPermissions.join(", "),
		});
		permissionsSeverity = "error";
	} else if (pendingPermissions.length > 0) {
		permissionsValue = t("health.permissionsPending", "Pending: {{permissions}}", {
			permissions: pendingPermissions.join(", "),
		});
		permissionsSeverity = "warning";
	} else if (unknownPermissions.length > 0) {
		permissionsValue = t("health.permissionsUnknown", "Unknown: {{permissions}}", {
			permissions: unknownPermissions.join(", "),
		});
		permissionsSeverity = "unknown";
	} else {
		permissionsValue = t("health.permissionsGranted", "Granted");
		permissionsSeverity = "success";
	}
	rows.push({
		id: "permissions",
		icon: "permissions",
		label: t("health.permissions", "Permissions"),
		value: permissionsValue,
		severity: permissionsSeverity,
	});

	return rows;
}

function RowIcon({ icon, severity }: { icon: HealthRowModel["icon"]; severity: HealthSeverity }) {
	const colorClass =
		{
			success: "recordingHealthIconSuccess",
			warning: "recordingHealthIconWarning",
			error: "recordingHealthIconError",
			neutral: "recordingHealthIconNeutral",
			unknown: "recordingHealthIconUnknown",
		}[severity] ?? "recordingHealthIconNeutral";

	switch (icon) {
		case "microphone":
			return <MicrophoneIcon size={16} className={popoverStyles[colorClass]} />;
		case "system-audio":
			return <WaveformIcon size={16} className={popoverStyles[colorClass]} />;
		case "camera":
			return <MonitorIcon size={16} className={popoverStyles[colorClass]} />;
		case "disk":
			return <HardDrivesIcon size={16} className={popoverStyles[colorClass]} />;
		case "permissions":
			return <ProhibitIcon size={16} className={popoverStyles[colorClass]} />;
		default:
			return <QuestionIcon size={16} className={popoverStyles[colorClass]} />;
	}
}

function StatusIndicator({ severity }: { severity: HealthSeverity }) {
	if (severity === "success") {
		return <CheckCircleIcon size={14} className={popoverStyles.recordingHealthStatusSuccess} />;
	}
	if (severity === "warning") {
		return (
			<WarningCircleIcon size={14} className={popoverStyles.recordingHealthStatusWarning} />
		);
	}
	if (severity === "error") {
		return <WarningCircleIcon size={14} className={popoverStyles.recordingHealthStatusError} />;
	}
	return <QuestionIcon size={14} className={popoverStyles.recordingHealthStatusUnknown} />;
}

export function RecordingHealthPopover({
	trigger,
	disabled,
	health,
	loading,
	microphoneEnabled,
	microphoneInputStatus,
	systemAudioEnabled,
	selectedSourceType,
	cameraDeviceCount,
	cameraDevicesLoading,
}: RecordingHealthPopoverProps) {
	const t = useScopedT("launch");
	const { isOpen, requestOpen, requestClose } = useLaunchPopoverCoordinator();
	const coordinatorOpen = isOpen(POPOVER_ID);
	const open = !disabled && coordinatorOpen;

	const rows = resolveRecordingHealthRows({
		t,
		health,
		loading,
		microphoneEnabled,
		microphoneInputStatus,
		systemAudioEnabled,
		selectedSourceType,
		cameraDeviceCount,
		cameraDevicesLoading,
	});

	const checkedAt = health?.checkedAt;
	const checkedAtDate = checkedAt ? new Date(checkedAt) : null;
	const checkedAtLabel = checkedAtDate
		? t("health.checkedAt", "Checked {{time}}", {
				time: checkedAtDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
			})
		: t("health.notChecked", "Not checked yet");

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
			aria-label={t("health.recordingHealth", "Recording health")}
			role="region"
			align="end"
		>
			<div className={styles.ddLabel}>{t("health.recordingHealth", "Recording health")}</div>
			<div
				className={popoverStyles.recordingHealthRows}
				role="list"
				aria-label={t("health.recordingHealth", "Recording health")}
			>
				{rows.map((row) => (
					<div
						key={row.id}
						className={`${styles.ddItem} ${popoverStyles.recordingHealthRow}`}
						role="listitem"
					>
						<span className="shrink-0">
							<RowIcon icon={row.icon} severity={row.severity} />
						</span>
						<span className="truncate">{row.label}</span>
						<span className={popoverStyles.recordingHealthTrailing}>
							<span className={popoverStyles.recordingHealthValue}>{row.value}</span>
							<StatusIndicator severity={row.severity} />
						</span>
					</div>
				))}
			</div>
			<div className={popoverStyles.recordingHealthFooter}>{checkedAtLabel}</div>
		</HudPopover>
	);
}
