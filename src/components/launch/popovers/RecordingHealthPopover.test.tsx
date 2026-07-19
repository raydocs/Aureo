import { type ReactNode, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { LaunchPopoverId } from "@/lib/launchPopoverIds";
import { HudInteractionContext } from "../contexts/HudInteractionContext";
import type { RecordingHealthSnapshot } from "../hooks/useRecordingHealth";
import { LaunchPopoverCoordinatorContext } from "./LaunchPopoverCoordinator";
import {
	RecordingHealthPopover,
	type RecordingHealthPopoverProps,
	resolveRecordingHealthRows,
} from "./RecordingHealthPopover";

function MockCoordinator({
	children,
	openId = null,
}: {
	children: ReactNode;
	openId?: LaunchPopoverId | null;
}) {
	const value = useMemo(
		() => ({
			openId,
			requestOpen: vi.fn<(id: LaunchPopoverId) => void>(),
			requestClose: vi.fn<(id: LaunchPopoverId) => void>(),
			isOpen: (id: LaunchPopoverId) => openId === id,
		}),
		[openId],
	);
	return (
		<LaunchPopoverCoordinatorContext.Provider value={value}>
			{children}
		</LaunchPopoverCoordinatorContext.Provider>
	);
}

function Wrapper({
	children,
	openId,
}: {
	children: React.ReactNode;
	openId?: LaunchPopoverId | null;
}) {
	return (
		<I18nProvider>
			<HudInteractionContext.Provider
				value={{ onMouseEnter: vi.fn(), onMouseLeave: vi.fn() }}
			>
				<MockCoordinator openId={openId}>{children}</MockCoordinator>
			</HudInteractionContext.Provider>
		</I18nProvider>
	);
}

const baseProps: Omit<RecordingHealthPopoverProps, "trigger"> = {
	health: null,
	loading: false,
	microphoneEnabled: true,
	microphoneInputStatus: "checking",
	systemAudioEnabled: true,
	selectedSourceType: "screen",
	cameraDeviceCount: 1,
	cameraDevicesLoading: false,
};

const baseHealth: RecordingHealthSnapshot = {
	success: true,
	platform: "darwin",
	checkedAt: new Date("2026-07-18T14:30:00Z").toISOString(),
	permissions: {
		screen: "granted",
		microphone: "granted",
		camera: "granted",
	},
	systemAudio: {
		supported: true,
		available: true,
		backend: "mac-screencapturekit",
	},
	storage: {
		path: "/Users/aureo/recordings",
		freeBytes: 50 * 1024 ** 3,
		status: "ok",
	},
};

const trigger = <button type="button">Health</button>;

describe("RecordingHealthPopover", () => {
	it("renders all health rows when open", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="recording-health">
				<RecordingHealthPopover
					{...baseProps}
					trigger={trigger}
					health={baseHealth}
					microphoneInputStatus="active"
				/>
			</Wrapper>,
		);

		expect(html).toContain("Recording health");
		expect(html).toContain("Microphone input");
		expect(html).toContain("System audio");
		expect(html).toContain("Camera");
		expect(html).toContain("Disk space");
		expect(html).toContain("Permissions");
		expect(html).toContain("Active");
		expect(html).toContain("Available");
		expect(html).toContain("Granted");
	});

	it("shows microphone active when input is active", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="recording-health">
				<RecordingHealthPopover
					{...baseProps}
					trigger={trigger}
					health={baseHealth}
					microphoneInputStatus="active"
				/>
			</Wrapper>,
		);

		expect(html).toContain("Active");
	});

	it("shows system audio unavailable when selected source is device", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="recording-health">
				<RecordingHealthPopover
					{...baseProps}
					trigger={trigger}
					selectedSourceType="device"
				/>
			</Wrapper>,
		);

		expect(html).toContain("Unavailable for device capture");
	});

	it("shows denied permissions when permissions are blocked", () => {
		const health: RecordingHealthSnapshot = {
			...baseHealth,
			permissions: {
				screen: "denied",
				microphone: "denied",
				camera: "restricted",
			},
		};

		const html = renderToStaticMarkup(
			<Wrapper openId="recording-health">
				<RecordingHealthPopover {...baseProps} trigger={trigger} health={health} />
			</Wrapper>,
		);

		expect(html).toContain("Blocked:");
		expect(html).toContain("Screen");
		expect(html).toContain("Microphone");
		expect(html).toContain("Camera");
	});

	it("shows low disk warning when storage is low", () => {
		const health: RecordingHealthSnapshot = {
			...baseHealth,
			storage: {
				path: "/Users/aureo/recordings",
				freeBytes: 500 * 1024 ** 2,
				status: "low",
			},
		};

		const html = renderToStaticMarkup(
			<Wrapper openId="recording-health">
				<RecordingHealthPopover {...baseProps} trigger={trigger} health={health} />
			</Wrapper>,
		);

		expect(html).toContain("0.5 GB free");
	});

	it("does not render the menu when closed", () => {
		const html = renderToStaticMarkup(
			<Wrapper>
				<RecordingHealthPopover {...baseProps} trigger={trigger} health={baseHealth} />
			</Wrapper>,
		);

		expect(html).not.toContain("Recording health");
		expect(html).not.toContain("Microphone input");
	});

	it("keeps the popover closed when disabled even if open is requested", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="recording-health">
				<RecordingHealthPopover
					{...baseProps}
					trigger={trigger}
					health={baseHealth}
					disabled
				/>
			</Wrapper>,
		);

		expect(html).not.toContain("Recording health");
		expect(html).not.toContain("Microphone input");
	});
});

describe("resolveRecordingHealthRows", () => {
	function t(key: string, fallback?: string, vars?: Record<string, string | number>) {
		const source = fallback ?? key;
		if (!vars) return source;
		return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, name) => {
			const value = vars[name];
			return value === undefined ? "" : String(value);
		});
	}

	it("marks microphone as off when disabled", () => {
		const rows = resolveRecordingHealthRows({
			t,
			...baseProps,
			microphoneEnabled: false,
		});

		const mic = rows.find((r) => r.id === "microphone");
		expect(mic?.value).toBe("Off");
		expect(mic?.severity).toBe("neutral");
	});

	it("marks microphone as error when permission denied", () => {
		const health: RecordingHealthSnapshot = {
			...baseHealth,
			permissions: { ...baseHealth.permissions, microphone: "denied" },
		};
		const rows = resolveRecordingHealthRows({
			t,
			...baseProps,
			health,
			microphoneInputStatus: "checking",
		});

		const mic = rows.find((r) => r.id === "microphone");
		expect(mic?.value).toBe("Microphone access denied");
		expect(mic?.severity).toBe("error");
	});

	it("reports device source system audio as unavailable even when the toggle is off", () => {
		const rows = resolveRecordingHealthRows({
			t,
			...baseProps,
			selectedSourceType: "device",
			systemAudioEnabled: false,
		});

		const audio = rows.find((r) => r.id === "system-audio");
		expect(audio?.value).toBe("Unavailable for device capture");
		expect(audio?.severity).toBe("warning");
	});

	it("reports camera not found when no devices are present", () => {
		const rows = resolveRecordingHealthRows({
			t,
			...baseProps,
			cameraDeviceCount: 0,
		});

		const camera = rows.find((r) => r.id === "camera");
		expect(camera?.value).toBe("No camera found");
		expect(camera?.severity).toBe("warning");
	});

	it("reports available camera with plural device count", () => {
		const rows = resolveRecordingHealthRows({
			t,
			...baseProps,
			cameraDeviceCount: 2,
		});

		const camera = rows.find((r) => r.id === "camera");
		expect(camera?.value).toBe("Available (2 devices)");
		expect(camera?.severity).toBe("success");
	});

	it("flags pending permissions as warning", () => {
		const health: RecordingHealthSnapshot = {
			...baseHealth,
			permissions: {
				screen: "not-determined",
				microphone: "granted",
				camera: "granted",
			},
		};
		const rows = resolveRecordingHealthRows({
			t,
			...baseProps,
			health,
		});

		const permissions = rows.find((r) => r.id === "permissions");
		expect(permissions?.value).toBe("Pending: Screen");
		expect(permissions?.severity).toBe("warning");
	});

	it("shows unknown permissions when no health snapshot is provided", () => {
		const rows = resolveRecordingHealthRows({
			t,
			...baseProps,
			health: null,
		});

		const permissions = rows.find((r) => r.id === "permissions");
		expect(permissions?.value).toBe("Unknown");
		expect(permissions?.severity).toBe("unknown");
	});

	it("does not report unsupported read-only permission checks as granted", () => {
		const health: RecordingHealthSnapshot = {
			...baseHealth,
			permissions: {
				screen: "unknown",
				microphone: "granted",
				camera: "unknown",
			},
		};
		const rows = resolveRecordingHealthRows({
			t,
			...baseProps,
			health,
		});

		const permissions = rows.find((r) => r.id === "permissions");
		expect(permissions?.value).toBe("Unknown: Screen, Camera");
		expect(permissions?.severity).toBe("unknown");
	});
});
