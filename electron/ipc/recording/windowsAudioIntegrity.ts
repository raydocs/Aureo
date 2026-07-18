import fs from "node:fs/promises";

/** Standard PCM WAV header size; files at or below this contain no audio payload. */
export const EMPTY_WAV_HEADER_BYTES = 44;

export type WindowsAudioSidecarKind = "system" | "mic";

export type WindowsAudioSidecarExpectation = {
	kind: WindowsAudioSidecarKind;
	/** Final expected native sidecar path. Null/undefined means the track was not requested natively. */
	path: string | null | undefined;
};

export type WindowsAudioSidecarInspection = {
	exists: boolean;
	isFile?: boolean;
	sizeBytes?: number;
	/** First bytes of the file when available (at least 12 for RIFF/WAVE). */
	header?: Uint8Array | null;
};

export type WindowsAudioSidecarIntegrityReason =
	| "not-requested"
	| "missing"
	| "not-file"
	| "empty-or-tiny"
	| "unreadable"
	| "invalid-header"
	| "ok";

export type WindowsAudioSidecarIntegrityResult = {
	ok: boolean;
	reason: WindowsAudioSidecarIntegrityReason;
	warning?: string;
};

function trackLabel(kind: WindowsAudioSidecarKind) {
	return kind === "system" ? "System audio" : "Microphone";
}

function isRiffWaveHeader(header: Uint8Array | null | undefined) {
	if (!header || header.length < 12) {
		return false;
	}

	// RIFF....WAVE
	return (
		header[0] === 0x52 && // R
		header[1] === 0x49 && // I
		header[2] === 0x46 && // F
		header[3] === 0x46 && // F
		header[8] === 0x57 && // W
		header[9] === 0x41 && // A
		header[10] === 0x56 && // V
		header[11] === 0x45 // E
	);
}

/**
 * Pure integrity evaluation for a Windows native audio sidecar.
 * Never throws; callers should surface results as soft warnings only.
 */
export function evaluateWindowsAudioSidecarIntegrity(
	kind: WindowsAudioSidecarKind,
	filePath: string | null | undefined,
	inspection?: WindowsAudioSidecarInspection | null,
): WindowsAudioSidecarIntegrityResult {
	if (!filePath) {
		return { ok: true, reason: "not-requested" };
	}

	if (!inspection || !inspection.exists) {
		return {
			ok: false,
			reason: "missing",
			warning: `${trackLabel(kind)} track is missing: ${filePath}`,
		};
	}

	if (inspection.isFile === false) {
		return {
			ok: false,
			reason: "not-file",
			warning: `${trackLabel(kind)} track is not a file: ${filePath}`,
		};
	}

	const sizeBytes = inspection.sizeBytes ?? 0;
	if (!Number.isFinite(sizeBytes) || sizeBytes <= EMPTY_WAV_HEADER_BYTES) {
		return {
			ok: false,
			reason: "empty-or-tiny",
			warning: `${trackLabel(kind)} track is empty or too small (${Math.max(0, Math.round(sizeBytes))} bytes): ${filePath}`,
		};
	}

	if (inspection.header == null) {
		return {
			ok: false,
			reason: "unreadable",
			warning: `${trackLabel(kind)} track header could not be read: ${filePath}`,
		};
	}
	if (!isRiffWaveHeader(inspection.header)) {
		return {
			ok: false,
			reason: "invalid-header",
			warning: `${trackLabel(kind)} track is not a valid WAV file: ${filePath}`,
		};
	}

	return { ok: true, reason: "ok" };
}

/**
 * Build expected native Windows audio sidecar checks from stop-time path state.
 * Browser mic fallback clears the native mic path, so it will not be expected here.
 */
export function buildWindowsNativeAudioSidecarExpectations(
	systemAudioPath: string | null | undefined,
	micAudioPath: string | null | undefined,
): Array<{ kind: WindowsAudioSidecarKind; path: string }> {
	const expectations: Array<{ kind: WindowsAudioSidecarKind; path: string }> = [];
	if (systemAudioPath) {
		expectations.push({ kind: "system", path: systemAudioPath });
	}
	if (micAudioPath) {
		expectations.push({ kind: "mic", path: micAudioPath });
	}
	return expectations;
}

export function collectWindowsAudioIntegrityWarnings(
	results: WindowsAudioSidecarIntegrityResult[],
): string[] {
	return results
		.map((result) => result.warning)
		.filter((warning): warning is string => typeof warning === "string" && warning.length > 0);
}

export async function inspectWindowsAudioSidecar(
	filePath: string,
): Promise<WindowsAudioSidecarInspection> {
	try {
		const stat = await fs.stat(filePath);
		if (!stat.isFile()) {
			return { exists: true, isFile: false, sizeBytes: stat.size };
		}

		let header: Uint8Array | null = null;
		try {
			const handle = await fs.open(filePath, "r");
			try {
				const buffer = Buffer.alloc(12);
				const { bytesRead } = await handle.read(buffer, 0, 12, 0);
				header = bytesRead > 0 ? buffer.subarray(0, bytesRead) : null;
			} finally {
				await handle.close();
			}
		} catch {
			header = null;
		}

		return {
			exists: true,
			isFile: true,
			sizeBytes: stat.size,
			header,
		};
	} catch {
		return { exists: false };
	}
}

/**
 * Soft-check expected native Windows audio sidecars after a successful stop.
 * Never deletes or rewrites media; returns warning strings only.
 */
export async function collectWindowsNativeAudioIntegrityWarnings(
	systemAudioPath: string | null | undefined,
	micAudioPath: string | null | undefined,
): Promise<string[]> {
	const expectations = buildWindowsNativeAudioSidecarExpectations(systemAudioPath, micAudioPath);
	const results = await Promise.all(
		expectations.map(async ({ kind, path: sidecarPath }) => {
			const inspection = await inspectWindowsAudioSidecar(sidecarPath);
			return evaluateWindowsAudioSidecarIntegrity(kind, sidecarPath, inspection);
		}),
	);
	return collectWindowsAudioIntegrityWarnings(results);
}
