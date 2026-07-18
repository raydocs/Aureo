import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { TMP_ROOT } = vi.hoisted(() => {
	const base = process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp";
	return {
		TMP_ROOT: `${base.replace(/\/$/, "")}/aureo-whisper-download-test`,
	};
});

vi.mock("electron", () => ({
	app: {
		getPath: (key: string) => {
			if (
				key === "appData" ||
				key === "userData" ||
				key === "temp" ||
				key === "sessionData"
			) {
				return TMP_ROOT;
			}
			throw new Error(`Unexpected app.getPath key: ${key}`);
		},
		setPath: () => undefined,
	},
	net: {
		fetch: vi.fn(),
	},
}));

import { type DownloadFetch, downloadFileWithProgress } from "./whisper";

function bytes(...values: number[]): Uint8Array {
	return Uint8Array.from(values);
}

function createChunkedResponse(
	chunks: Uint8Array[],
	init: {
		status?: number;
		headers?: HeadersInit;
		chunkDelayMs?: number;
		/** Delay before the first chunk is enqueued. */
		initialDelayMs?: number;
	} = {},
): Response {
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			if (init.initialDelayMs) {
				await new Promise((resolve) => setTimeout(resolve, init.initialDelayMs));
			}
			for (const [index, chunk] of chunks.entries()) {
				if (index > 0 && init.chunkDelayMs) {
					await new Promise((resolve) => setTimeout(resolve, init.chunkDelayMs));
				}
				controller.enqueue(chunk);
			}
			controller.close();
		},
	});

	return new Response(stream, {
		status: init.status ?? 200,
		headers: init.headers,
	});
}

async function readDestination(filePath: string): Promise<number[]> {
	return Array.from(new Uint8Array(await fs.readFile(filePath)));
}

describe("downloadFileWithProgress", () => {
	const createdPaths: string[] = [];

	afterEach(async () => {
		await Promise.allSettled(createdPaths.map((filePath) => fs.rm(filePath, { force: true })));
		createdPaths.length = 0;
		await fs.rm(TMP_ROOT, { recursive: true, force: true });
	});

	async function tempFile(name: string): Promise<string> {
		await fs.mkdir(TMP_ROOT, { recursive: true });
		const filePath = path.join(TMP_ROOT, name);
		createdPaths.push(filePath);
		return filePath;
	}

	it("streams chunks, reports progress, and writes the full file on success", async () => {
		const destinationPath = await tempFile("success.bin");
		const progress: number[] = [];
		const body = [bytes(1, 2, 3, 4), bytes(5, 6), bytes(7, 8, 9, 10)];
		const fetchImpl: DownloadFetch = async () =>
			createChunkedResponse(body, {
				headers: { "content-length": "10" },
			});

		await downloadFileWithProgress(
			"https://example.test/model.bin",
			destinationPath,
			(value) => {
				progress.push(value);
			},
			{ fetchImpl },
		);

		expect(await readDestination(destinationPath)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		expect(progress).toContain(40);
		expect(progress).toContain(60);
		expect(progress.at(-1)).toBe(100);
	});

	it("fails when Content-Length is present but the body is truncated", async () => {
		const destinationPath = await tempFile("truncated.bin");
		const fetchImpl: DownloadFetch = async () =>
			createChunkedResponse([bytes(1, 2, 3)], {
				headers: { "content-length": "10" },
			});

		await expect(
			downloadFileWithProgress(
				"https://example.test/model.bin",
				destinationPath,
				() => undefined,
				{
					fetchImpl,
				},
			),
		).rejects.toThrow(/incomplete: expected 10 bytes but received 3/i);
	});

	it("aborts when no chunk arrives within the idle timeout", async () => {
		const destinationPath = await tempFile("idle.bin");
		const fetchImpl: DownloadFetch = async () =>
			createChunkedResponse([bytes(1), bytes(2)], {
				headers: { "content-length": "2" },
				chunkDelayMs: 80,
			});

		await expect(
			downloadFileWithProgress(
				"https://example.test/model.bin",
				destinationPath,
				() => undefined,
				{
					fetchImpl,
					idleTimeoutMs: 20,
				},
			),
		).rejects.toThrow(/timed out due to inactivity/i);
	});

	it("surfaces readable fetch transport errors", async () => {
		const destinationPath = await tempFile("fetch-error.bin");
		const fetchImpl: DownloadFetch = async () => {
			throw new Error("proxy connection refused");
		};

		await expect(
			downloadFileWithProgress(
				"https://example.test/model.bin",
				destinationPath,
				() => undefined,
				{
					fetchImpl,
				},
			),
		).rejects.toThrow(/proxy connection refused/i);
	});

	it("surfaces file creation errors without hanging", async () => {
		await fs.mkdir(TMP_ROOT, { recursive: true });
		const destinationPath = path.join(TMP_ROOT, "missing-directory", "model.bin");
		const fetchImpl: DownloadFetch = async () =>
			createChunkedResponse([bytes(1, 2, 3)], {
				headers: { "content-length": "3" },
			});

		await expect(
			downloadFileWithProgress(
				"https://example.test/model.bin",
				destinationPath,
				() => undefined,
				{ fetchImpl },
			),
		).rejects.toThrow();
	});

	it("surfaces non-OK HTTP status as a readable error", async () => {
		const destinationPath = await tempFile("http-error.bin");
		const fetchImpl: DownloadFetch = async () =>
			createChunkedResponse([], {
				status: 503,
				headers: { "content-length": "0" },
			});

		await expect(
			downloadFileWithProgress(
				"https://example.test/model.bin",
				destinationPath,
				() => undefined,
				{
					fetchImpl,
				},
			),
		).rejects.toThrow(/status 503/i);
	});

	it("passes an AbortSignal to the injected transport", async () => {
		const destinationPath = await tempFile("signal.bin");
		const fetchImpl = vi.fn<DownloadFetch>(async (_url, init) => {
			expect(init?.signal).toBeInstanceOf(AbortSignal);
			return createChunkedResponse([bytes(9)], {
				headers: { "content-length": "1" },
			});
		});

		await downloadFileWithProgress(
			"https://example.test/model.bin",
			destinationPath,
			() => undefined,
			{
				fetchImpl,
			},
		);

		expect(fetchImpl).toHaveBeenCalledOnce();
		expect(await readDestination(destinationPath)).toEqual([9]);
	});
});
