export const LAUNCH_POPOVER_IDS = [
	"sources",
	"record-confirm",
	"projects",
	"countdown",
	"mic",
	"more",
	"quality",
	"recording-health",
	"webcam",
] as const;

export type LaunchPopoverId = (typeof LAUNCH_POPOVER_IDS)[number];

export const NATIVE_OPENABLE_LAUNCH_POPOVER_IDS = [
	"webcam",
	"more",
] as const satisfies readonly LaunchPopoverId[];

export type NativeOpenableLaunchPopoverId = (typeof NATIVE_OPENABLE_LAUNCH_POPOVER_IDS)[number];

export const NATIVE_CAPTURE_SOURCE_TYPES = ["screen", "window", "area", "device"] as const;
export type NativeCaptureSourceType = (typeof NATIVE_CAPTURE_SOURCE_TYPES)[number];

export function isNativeOpenableLaunchPopoverId(
	popoverId: string,
): popoverId is NativeOpenableLaunchPopoverId {
	return (NATIVE_OPENABLE_LAUNCH_POPOVER_IDS as readonly string[]).includes(popoverId);
}
