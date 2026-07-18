import { describe, expect, it } from "vitest";
import {
	classifyDiskSpace,
	freeBytesFromStatfs,
	LOW_DISK_WARNING_BYTES,
	normalizeMediaAccessStatus,
	portableMediaPermissionFallback,
	resolveSystemAudioCapability,
} from "./healthCore";

describe("normalizeMediaAccessStatus", () => {
	it.each([
		["granted", "granted"],
		["DENIED", "denied"],
		[" Not-Determined ", "not-determined"],
		["restricted", "restricted"],
		["unknown", "unknown"],
		["", "unknown"],
		["maybe", "unknown"],
		[null, "unknown"],
		[12, "unknown"],
	] as const)("maps %j to %j", (input, expected) => {
		expect(normalizeMediaAccessStatus(input)).toBe(expected);
	});
});

describe("portableMediaPermissionFallback", () => {
	it("does not invent permission grants on platforms without a read-only query", () => {
		expect(portableMediaPermissionFallback("win32")).toBe("unknown");
		expect(portableMediaPermissionFallback("linux")).toBe("unknown");
		expect(portableMediaPermissionFallback("darwin")).toBe("unknown");
	});
});

describe("freeBytesFromStatfs", () => {
	it("multiplies available blocks by block size", () => {
		expect(freeBytesFromStatfs({ bavail: 100, bsize: 4096 })).toBe(409_600);
	});

	it("accepts bigint statfs fields", () => {
		expect(freeBytesFromStatfs({ bavail: 10n, bsize: 1024n })).toBe(10_240);
	});

	it("rejects invalid stats", () => {
		expect(freeBytesFromStatfs({ bavail: -1, bsize: 4096 })).toBeNull();
		expect(freeBytesFromStatfs({ bavail: 10, bsize: 0 })).toBeNull();
	});
});

describe("classifyDiskSpace", () => {
	it("returns unknown for missing free-byte probes", () => {
		expect(classifyDiskSpace(null)).toBe("unknown");
		expect(classifyDiskSpace(Number.NaN)).toBe("unknown");
	});

	it("flags free space below the warning threshold as low", () => {
		expect(classifyDiskSpace(LOW_DISK_WARNING_BYTES - 1)).toBe("low");
		expect(classifyDiskSpace(LOW_DISK_WARNING_BYTES)).toBe("ok");
		expect(classifyDiskSpace(LOW_DISK_WARNING_BYTES + 1)).toBe("ok");
	});
});

describe("resolveSystemAudioCapability", () => {
	it("uses ScreenCaptureKit availability on macOS without inventing a permission", () => {
		expect(
			resolveSystemAudioCapability({
				platform: "darwin",
				nativeWindowsCaptureAvailable: false,
				nativeMacCaptureHelperPresent: true,
			}),
		).toEqual({
			supported: true,
			available: true,
			backend: "mac-screencapturekit",
		});

		expect(
			resolveSystemAudioCapability({
				platform: "darwin",
				nativeWindowsCaptureAvailable: true,
				nativeMacCaptureHelperPresent: false,
			}),
		).toEqual({
			supported: true,
			available: false,
			backend: "none",
		});
	});

	it("prefers native Windows capture when the helper is present", () => {
		expect(
			resolveSystemAudioCapability({
				platform: "win32",
				nativeWindowsCaptureAvailable: true,
				nativeMacCaptureHelperPresent: false,
			}),
		).toEqual({
			supported: true,
			available: true,
			backend: "windows-wgc",
		});
	});

	it("falls back to browser capture on Windows without the native helper", () => {
		expect(
			resolveSystemAudioCapability({
				platform: "win32",
				nativeWindowsCaptureAvailable: false,
				nativeMacCaptureHelperPresent: false,
			}),
		).toEqual({
			supported: true,
			available: true,
			backend: "browser",
		});
	});

	it("reports browser best-effort support on Linux", () => {
		expect(
			resolveSystemAudioCapability({
				platform: "linux",
				nativeWindowsCaptureAvailable: false,
				nativeMacCaptureHelperPresent: false,
			}),
		).toEqual({
			supported: true,
			available: true,
			backend: "browser",
		});
	});
});
