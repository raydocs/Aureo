import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface TestExtensionOptions {
	id: string;
	name: string;
}

describe("extension v1 trust policy", () => {
	let tempRoot: string;
	let appPath: string;
	let userDataPath: string;

	async function writeExtension(parent: string, options: TestExtensionOptions) {
		const extensionPath = path.join(parent, options.id);
		await fs.mkdir(extensionPath, { recursive: true });
		await fs.writeFile(
			path.join(extensionPath, "aureo-extension.json"),
			JSON.stringify({
				id: options.id,
				name: options.name,
				version: "1.0.0",
				main: "index.js",
				permissions: [],
			}),
		);
		await fs.writeFile(path.join(extensionPath, "index.js"), "export function activate() {}\n");
		return extensionPath;
	}

	beforeEach(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aureo-extension-policy-"));
		appPath = path.join(tempRoot, "app");
		userDataPath = path.join(tempRoot, "user-data");
		await fs.mkdir(appPath, { recursive: true });
		await fs.mkdir(userDataPath, { recursive: true });

		vi.resetModules();
		vi.doMock("electron", () => ({
			app: {
				isPackaged: false,
				getAppPath: () => appPath,
				getPath: (name: string) => (name === "userData" ? userDataPath : tempRoot),
			},
		}));
	});

	afterEach(async () => {
		vi.resetModules();
		vi.doUnmock("electron");
		delete process.env.AUREO_MARKETPLACE_URL;
		vi.unstubAllGlobals();
		await fs.rm(tempRoot, { recursive: true, force: true });
	});

	it("keeps a builtin extension authoritative when a user extension shadows its ID", async () => {
		const id = "com.aureo.safe-builtin";
		await writeExtension(path.join(appPath, "public", "builtin-extensions"), {
			id,
			name: "Trusted Builtin",
		});
		await writeExtension(path.join(userDataPath, "extensions"), {
			id,
			name: "User Shadow",
		});
		const { discoverExtensions } = await import("./extensionLoader");

		const discovered = await discoverExtensions();

		expect(discovered).toHaveLength(1);
		expect(discovered[0]).toMatchObject({
			builtin: true,
			manifest: { id, name: "Trusted Builtin" },
		});
	});

	it("rejects enabling a discovered non-builtin extension", async () => {
		const id = "com.example.untrusted";
		await writeExtension(path.join(userDataPath, "extensions"), {
			id,
			name: "Untrusted",
		});
		const { discoverExtensions, getExtension, setExtensionStatus } = await import(
			"./extensionLoader"
		);

		await discoverExtensions();

		await expect(setExtensionStatus(id, "active")).resolves.toBe(false);
		expect(getExtension(id)?.status).not.toBe("active");
	});

	it("rejects a valid non-builtin install before copying it into user data", async () => {
		const sourcePath = await writeExtension(path.join(tempRoot, "downloads"), {
			id: "com.example.install-me",
			name: "Install Me",
		});
		const { installExtensionFromPath } = await import("./extensionLoader");

		await expect(installExtensionFromPath(sourcePath)).resolves.toBeNull();
		await expect(
			fs.access(path.join(userDataPath, "extensions", "com.example.install-me")),
		).rejects.toThrow();
	});

	it("rejects marketplace installs before downloading an archive", async () => {
		process.env.AUREO_MARKETPLACE_URL = "https://extensions.example.com";
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const { downloadAndInstallExtension } = await import("./extensionMarketplace");

		await expect(
			downloadAndInstallExtension(
				"com.example.marketplace",
				"https://extensions.example.com/download.zip",
			),
		).resolves.toEqual({
			success: false,
			error: "Aureo v1 non-builtin extensions are disabled",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
