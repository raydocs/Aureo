import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		getAppPath: () => process.cwd(),
		getPath: () => process.env.TEMP ?? process.cwd(),
		setPath: () => undefined,
		isPackaged: false,
	},
	BrowserWindow: {
		fromWebContents: () => null,
	},
	dialog: {
		showSaveDialog: vi.fn(),
	},
	ipcMain: {
		handle: vi.fn(),
	},
	powerSaveBlocker: {
		isStarted: () => true,
		start: () => 1,
		stop: vi.fn(),
	},
}));

vi.mock("../ffmpeg/binary", () => ({
	getFfmpegBinaryPath: () => "ffmpeg",
}));

import { moveExportedTempFile } from "./export";

const tempDirs: string[] = [];

async function makeTempDir() {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aureo-export-move-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.allSettled(
		tempDirs.splice(0).map((dir) => fs.rm(dir, { force: true, recursive: true })),
	);
});

async function listPartialArtifacts(dir: string) {
	const entries = await fs.readdir(dir);
	return entries.filter((name) => name.includes(".aureo-partial-"));
}

function forceInitialRenameError(
	tempPath: string,
	destinationPath: string,
	code: NodeJS.ErrnoException["code"],
	message: string,
) {
	const originalRename = fs.rename.bind(fs);
	const renameSpy = vi.spyOn(fs, "rename");
	renameSpy.mockImplementation(async (from, to) => {
		if (from === tempPath && to === destinationPath) {
			const error = new Error(message) as NodeJS.ErrnoException;
			error.code = code;
			throw error;
		}

		return originalRename(from, to);
	});
	return renameSpy;
}

describe("moveExportedTempFile", () => {
	it("moves an app-managed export temp file to the selected destination", async () => {
		const dir = await makeTempDir();
		const tempPath = path.join(dir, "export-temp.mp4");
		const destinationPath = path.join(dir, "export-final.mp4");
		await fs.writeFile(tempPath, "aureo-export");

		await moveExportedTempFile(tempPath, destinationPath);

		await expect(fs.readFile(destinationPath, "utf8")).resolves.toBe("aureo-export");
		await expect(fs.access(tempPath)).rejects.toThrow();
	});

	it("falls back when Windows reports the destination already exists during initial rename", async () => {
		const dir = await makeTempDir();
		const tempPath = path.join(dir, "export-temp.mp4");
		const destinationPath = path.join(dir, "export-final.mp4");
		await fs.writeFile(tempPath, "new-export");
		await fs.writeFile(destinationPath, "previous-export");

		forceInitialRenameError(tempPath, destinationPath, "EEXIST", "destination exists");

		await moveExportedTempFile(tempPath, destinationPath);

		await expect(fs.readFile(destinationPath, "utf8")).resolves.toBe("new-export");
		await expect(fs.access(tempPath)).rejects.toThrow();
	});

	it("falls back on EXDEV, validates final bytes, and removes the source temp", async () => {
		const dir = await makeTempDir();
		const tempPath = path.join(dir, "export-temp.mp4");
		const destinationPath = path.join(dir, "export-final.mp4");
		await fs.writeFile(tempPath, "cross-volume-export");

		forceInitialRenameError(tempPath, destinationPath, "EXDEV", "cross-device link");

		await moveExportedTempFile(tempPath, destinationPath);

		await expect(fs.readFile(destinationPath, "utf8")).resolves.toBe("cross-volume-export");
		await expect(fs.access(tempPath)).rejects.toThrow();
		await expect(listPartialArtifacts(dir)).resolves.toEqual([]);
	});

	it("cleans partial artifacts and preserves source and destination when copy fails", async () => {
		const dir = await makeTempDir();
		const tempPath = path.join(dir, "export-temp.mp4");
		const destinationPath = path.join(dir, "export-final.mp4");
		await fs.writeFile(tempPath, "new-export");
		await fs.writeFile(destinationPath, "previous-export");

		forceInitialRenameError(tempPath, destinationPath, "EXDEV", "cross-device link");
		vi.spyOn(fs, "copyFile").mockRejectedValue(new Error("copy failed"));

		await expect(moveExportedTempFile(tempPath, destinationPath)).rejects.toThrow(
			"copy failed",
		);

		await expect(fs.readFile(tempPath, "utf8")).resolves.toBe("new-export");
		await expect(fs.readFile(destinationPath, "utf8")).resolves.toBe("previous-export");
		await expect(listPartialArtifacts(dir)).resolves.toEqual([]);
	});

	it("fails closed on byte-size mismatch without replacing the destination", async () => {
		const dir = await makeTempDir();
		const tempPath = path.join(dir, "export-temp.mp4");
		const destinationPath = path.join(dir, "export-final.mp4");
		await fs.writeFile(tempPath, "new-export-bytes");
		await fs.writeFile(destinationPath, "previous-export");

		forceInitialRenameError(tempPath, destinationPath, "EXDEV", "cross-device link");
		vi.spyOn(fs, "copyFile").mockImplementation(async (_from, to) => {
			await fs.writeFile(String(to), "truncated");
		});

		await expect(moveExportedTempFile(tempPath, destinationPath)).rejects.toThrow(
			/size mismatch/i,
		);

		await expect(fs.readFile(tempPath, "utf8")).resolves.toBe("new-export-bytes");
		await expect(fs.readFile(destinationPath, "utf8")).resolves.toBe("previous-export");
		await expect(listPartialArtifacts(dir)).resolves.toEqual([]);
	});

	it("does not replace the prior destination when the partial file cannot be synced", async () => {
		const dir = await makeTempDir();
		const tempPath = path.join(dir, "export-temp.mp4");
		const destinationPath = path.join(dir, "export-final.mp4");
		await fs.writeFile(tempPath, "new-export");
		await fs.writeFile(destinationPath, "previous-export");

		forceInitialRenameError(tempPath, destinationPath, "EXDEV", "cross-device link");
		const originalOpen = fs.open.bind(fs);
		vi.spyOn(fs, "open").mockImplementation(async (target, flags, mode) => {
			if (String(target).includes(".aureo-partial-")) {
				return {
					sync: async () => {
						const error = new Error("sync failed") as NodeJS.ErrnoException;
						error.code = "EIO";
						throw error;
					},
					close: async () => undefined,
				} as Awaited<ReturnType<typeof fs.open>>;
			}

			return originalOpen(target, flags as never, mode as never);
		});

		await expect(moveExportedTempFile(tempPath, destinationPath)).rejects.toThrow(
			"sync failed",
		);

		await expect(fs.readFile(tempPath, "utf8")).resolves.toBe("new-export");
		await expect(fs.readFile(destinationPath, "utf8")).resolves.toBe("previous-export");
		await expect(listPartialArtifacts(dir)).resolves.toEqual([]);
	});

	it("restores the prior destination when partial promotion fails", async () => {
		const dir = await makeTempDir();
		const tempPath = path.join(dir, "export-temp.mp4");
		const destinationPath = path.join(dir, "export-final.mp4");
		await fs.writeFile(tempPath, "new-export");
		await fs.writeFile(destinationPath, "previous-export");

		const originalRename = fs.rename.bind(fs);
		let failedPromotion = false;
		vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
			if (from === tempPath && to === destinationPath) {
				const error = new Error("cross-device link") as NodeJS.ErrnoException;
				error.code = "EXDEV";
				throw error;
			}

			if (
				!failedPromotion &&
				String(from).includes(".aureo-partial-") &&
				to === destinationPath
			) {
				failedPromotion = true;
				const error = new Error("promotion failed") as NodeJS.ErrnoException;
				error.code = "EIO";
				throw error;
			}

			return originalRename(from, to);
		});

		await expect(moveExportedTempFile(tempPath, destinationPath)).rejects.toThrow(
			"promotion failed",
		);

		await expect(fs.readFile(tempPath, "utf8")).resolves.toBe("new-export");
		await expect(fs.readFile(destinationPath, "utf8")).resolves.toBe("previous-export");
		await expect(listPartialArtifacts(dir)).resolves.toEqual([]);
	});

	it("rolls back the promoted export when destination directory sync fails", async () => {
		const dir = await makeTempDir();
		const tempPath = path.join(dir, "export-temp.mp4");
		const destinationPath = path.join(dir, "export-final.mp4");
		await fs.writeFile(tempPath, "new-export");
		await fs.writeFile(destinationPath, "previous-export");

		forceInitialRenameError(tempPath, destinationPath, "EXDEV", "cross-device link");
		const originalOpen = fs.open.bind(fs);
		let directorySyncAttempts = 0;
		vi.spyOn(fs, "open").mockImplementation(async (target, flags, mode) => {
			if (target === dir && flags === "r" && directorySyncAttempts++ === 0) {
				return {
					sync: async () => {
						const error = new Error("directory sync failed") as NodeJS.ErrnoException;
						error.code = "EIO";
						throw error;
					},
					close: async () => undefined,
				} as Awaited<ReturnType<typeof fs.open>>;
			}

			return originalOpen(target, flags as never, mode as never);
		});

		await expect(moveExportedTempFile(tempPath, destinationPath)).rejects.toThrow(
			"directory sync failed",
		);

		await expect(fs.readFile(tempPath, "utf8")).resolves.toBe("new-export");
		await expect(fs.readFile(destinationPath, "utf8")).resolves.toBe("previous-export");
		await expect(listPartialArtifacts(dir)).resolves.toEqual([]);
	});
});
