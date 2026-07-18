import { createWriteStream, constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import type Electron from "electron";
import {
	WHISPER_MODEL_DIR,
	WHISPER_MODEL_DOWNLOAD_URL,
	WHISPER_SMALL_MODEL_PATH,
} from "../constants";

/** Idle timeout between download chunks (and before first response). Reset on every chunk. */
export const WHISPER_DOWNLOAD_IDLE_TIMEOUT_MS = 30_000;

export type DownloadFetch = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export type DownloadFileWithProgressOptions = {
	/** Injected transport for tests; production default is Electron `net.fetch` (proxy/PAC aware). */
	fetchImpl?: DownloadFetch;
	idleTimeoutMs?: number;
};

export function sendWhisperModelDownloadProgress(
	webContents: Electron.WebContents,
	payload: {
		status: "idle" | "downloading" | "downloaded" | "error";
		progress: number;
		path?: string | null;
		error?: string;
	},
) {
	webContents.send("whisper-small-model-download-progress", payload);
}

export async function getWhisperSmallModelStatus() {
	try {
		await fs.access(WHISPER_SMALL_MODEL_PATH, fsConstants.R_OK);
		return {
			success: true,
			exists: true,
			path: WHISPER_SMALL_MODEL_PATH,
		};
	} catch {
		return {
			success: true,
			exists: false,
			path: null,
		};
	}
}

function formatDownloadError(error: unknown, fallback: string): Error {
	if (error instanceof Error) {
		if (error.name === "AbortError") {
			return new Error("Whisper model download timed out due to inactivity.");
		}
		return error;
	}
	return new Error(`${fallback}: ${String(error)}`);
}

async function defaultElectronFetch(
	input: string,
	init?: { signal?: AbortSignal },
): Promise<Response> {
	const { net } = await import("electron");
	return net.fetch(input, init);
}

function readWithIdleTimeout(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	idleTimeoutMs: number,
	controller: AbortController,
): Promise<ReadableStreamReadResult<Uint8Array>> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			const error = new Error("Whisper model download timed out due to inactivity.");
			controller.abort(error);
			void reader.cancel(error).catch(() => undefined);
			reject(error);
		}, idleTimeoutMs);

		reader.read().then(
			(result) => {
				clearTimeout(timer);
				resolve(result);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

function writeChunkToStream(fileStream: ReturnType<typeof createWriteStream>, chunk: Uint8Array) {
	return new Promise<void>((resolve, reject) => {
		fileStream.write(Buffer.from(chunk), (error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

function endFileStream(fileStream: ReturnType<typeof createWriteStream>) {
	return new Promise<void>((resolve, reject) => {
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const onClose = () => {
			cleanup();
			resolve();
		};
		const cleanup = () => {
			fileStream.off("error", onError);
			fileStream.off("close", onClose);
		};

		fileStream.once("error", onError);
		fileStream.once("close", onClose);
		fileStream.end();
	});
}

/**
 * Download a file with streaming progress. Production uses Electron `net.fetch`
 * so system proxy / PAC settings are honored. Redirects are followed by fetch.
 */
export async function downloadFileWithProgress(
	url: string,
	destinationPath: string,
	onProgress: (progress: number) => void,
	options: DownloadFileWithProgressOptions = {},
): Promise<void> {
	const fetchImpl = options.fetchImpl ?? defaultElectronFetch;
	const idleTimeoutMs = options.idleTimeoutMs ?? WHISPER_DOWNLOAD_IDLE_TIMEOUT_MS;
	const controller = new AbortController();

	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	const clearIdleTimer = () => {
		if (idleTimer !== undefined) {
			clearTimeout(idleTimer);
			idleTimer = undefined;
		}
	};

	let response: Response;
	try {
		response = await Promise.race([
			fetchImpl(url, { signal: controller.signal }),
			new Promise<never>((_, reject) => {
				idleTimer = setTimeout(() => {
					const error = new Error("Whisper model download timed out due to inactivity.");
					controller.abort(error);
					reject(error);
				}, idleTimeoutMs);
			}),
		]);
	} catch (error) {
		clearIdleTimer();
		if (controller.signal.aborted) {
			const reason = controller.signal.reason;
			throw reason instanceof Error
				? reason
				: new Error("Whisper model download timed out due to inactivity.");
		}
		throw formatDownloadError(error, "Whisper model download failed");
	} finally {
		clearIdleTimer();
	}

	if (!response.ok) {
		try {
			await response.body?.cancel();
		} catch {
			// ignore cancel failures while surfacing the HTTP status
		}
		throw new Error(`Whisper model download failed with status ${response.status}.`);
	}

	const contentLengthHeader = response.headers.get("content-length");
	const hasContentLength = contentLengthHeader !== null && contentLengthHeader !== "";
	const totalBytes = hasContentLength ? Number.parseInt(contentLengthHeader, 10) : Number.NaN;
	if (hasContentLength && !Number.isFinite(totalBytes)) {
		try {
			await response.body?.cancel();
		} catch {
			// ignore
		}
		throw new Error(
			`Whisper model download failed: invalid Content-Length header (${contentLengthHeader}).`,
		);
	}

	if (!response.body) {
		throw new Error("Whisper model download failed: empty response body.");
	}

	const reader = response.body.getReader();
	const fileStream = createWriteStream(destinationPath);
	let fileStreamError: Error | null = null;
	fileStream.on("error", (error) => {
		fileStreamError ??= error;
	});
	let downloadedBytes = 0;
	let settled = false;

	const fail = async (error: unknown): Promise<never> => {
		if (!settled) {
			settled = true;
			const streamClosed = fileStream.closed
				? Promise.resolve()
				: new Promise<void>((resolve) => fileStream.once("close", resolve));
			fileStream.destroy();
			await streamClosed;
			try {
				await reader.cancel();
			} catch {
				// ignore
			}
		}
		if (controller.signal.aborted) {
			const reason = controller.signal.reason;
			throw reason instanceof Error
				? reason
				: new Error("Whisper model download timed out due to inactivity.");
		}
		throw formatDownloadError(error, "Whisper model download failed");
	};

	try {
		while (true) {
			const { done, value } = await readWithIdleTimeout(reader, idleTimeoutMs, controller);
			if (done) {
				break;
			}
			if (!value || value.byteLength === 0) {
				continue;
			}
			if (fileStreamError) {
				await fail(fileStreamError);
			}

			await writeChunkToStream(fileStream, value);
			downloadedBytes += value.byteLength;

			if (hasContentLength && totalBytes > 0) {
				onProgress(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)));
			}
		}

		if (hasContentLength && downloadedBytes !== totalBytes) {
			await fail(
				new Error(
					`Whisper model download incomplete: expected ${totalBytes} bytes but received ${downloadedBytes}.`,
				),
			);
		}
		if (fileStreamError) {
			await fail(fileStreamError);
		}

		await endFileStream(fileStream);
		settled = true;
		onProgress(100);
	} catch (error) {
		await fail(error);
	}
}

export async function downloadWhisperSmallModel(
	webContents: Electron.WebContents,
): Promise<string> {
	await fs.mkdir(WHISPER_MODEL_DIR, { recursive: true });
	const tempPath = `${WHISPER_SMALL_MODEL_PATH}.download`;

	sendWhisperModelDownloadProgress(webContents, {
		status: "downloading",
		progress: 0,
		path: null,
	});

	try {
		await fs.rm(tempPath, { force: true });
		await downloadFileWithProgress(WHISPER_MODEL_DOWNLOAD_URL, tempPath, (progress) => {
			sendWhisperModelDownloadProgress(webContents, {
				status: "downloading",
				progress,
				path: null,
			});
		});
		await fs.rename(tempPath, WHISPER_SMALL_MODEL_PATH);
		sendWhisperModelDownloadProgress(webContents, {
			status: "downloaded",
			progress: 100,
			path: WHISPER_SMALL_MODEL_PATH,
		});
		return WHISPER_SMALL_MODEL_PATH;
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
		sendWhisperModelDownloadProgress(webContents, {
			status: "error",
			progress: 0,
			path: null,
			error: String(error),
		});
		throw error;
	}
}

export async function deleteWhisperSmallModel(): Promise<void> {
	await fs.rm(WHISPER_SMALL_MODEL_PATH, { force: true });
}
