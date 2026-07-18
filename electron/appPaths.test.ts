import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setPath = vi.fn();
let pinnedUserData: string | undefined;

const getPath = vi.fn((name: string) => {
	if (name === "appData") {
		return "/mock/appData";
	}
	if (name === "userData") {
		return pinnedUserData ?? "/mock/appData/default";
	}
	return `/mock/${name}`;
});

vi.mock("electron", () => ({
	app: {
		getPath: (name: string) => getPath(name),
		setPath: (name: string, value: string) => {
			setPath(name, value);
			if (name === "userData") {
				pinnedUserData = value;
			}
		},
	},
}));

describe("appPaths", () => {
	const originalDevServerUrl = process.env["VITE_DEV_SERVER_URL"];
	const originalCertificationMode = process.env["AUREO_CERTIFICATION_MODE"];
	const originalCertificationUserDataDir = process.env["AUREO_CERTIFICATION_USER_DATA_DIR"];

	beforeEach(() => {
		vi.resetModules();
		setPath.mockClear();
		getPath.mockClear();
		pinnedUserData = undefined;
		delete process.env["VITE_DEV_SERVER_URL"];
		delete process.env["AUREO_CERTIFICATION_MODE"];
		delete process.env["AUREO_CERTIFICATION_USER_DATA_DIR"];
	});

	afterEach(() => {
		if (originalDevServerUrl === undefined) {
			delete process.env["VITE_DEV_SERVER_URL"];
		} else {
			process.env["VITE_DEV_SERVER_URL"] = originalDevServerUrl;
		}
		if (originalCertificationMode === undefined) {
			delete process.env["AUREO_CERTIFICATION_MODE"];
		} else {
			process.env["AUREO_CERTIFICATION_MODE"] = originalCertificationMode;
		}
		if (originalCertificationUserDataDir === undefined) {
			delete process.env["AUREO_CERTIFICATION_USER_DATA_DIR"];
		} else {
			process.env["AUREO_CERTIFICATION_USER_DATA_DIR"] = originalCertificationUserDataDir;
		}
	});

	it("pins production userData and sessionData under Aureo", async () => {
		const mod = await import("./appPaths");

		expect(setPath).toHaveBeenCalledWith("userData", path.join("/mock/appData", "Aureo"));
		expect(setPath).toHaveBeenCalledWith(
			"sessionData",
			path.join("/mock/appData", "Aureo", "session"),
		);
		expect(mod.USER_DATA_PATH).toBe(path.join("/mock/appData", "Aureo"));
		expect(mod.RECORDINGS_DIR).toBe(path.join("/mock/appData", "Aureo", "recordings"));
	});

	it("pins dev userData and sessionData under Aureo-dev", async () => {
		process.env["VITE_DEV_SERVER_URL"] = "http://localhost:5173";
		const mod = await import("./appPaths");

		expect(setPath).toHaveBeenCalledWith("userData", path.join("/mock/appData", "Aureo-dev"));
		expect(setPath).toHaveBeenCalledWith(
			"sessionData",
			path.join("/mock/appData", "Aureo-dev", "session"),
		);
		expect(mod.USER_DATA_PATH).toBe(path.join("/mock/appData", "Aureo-dev"));
		expect(mod.RECORDINGS_DIR).toBe(path.join("/mock/appData", "Aureo-dev", "recordings"));
	});

	it("uses an isolated absolute userData path in certification mode", async () => {
		const certificationPath = path.join("/tmp", "aureo-certification-user-data");
		process.env["AUREO_CERTIFICATION_MODE"] = "1";
		process.env["AUREO_CERTIFICATION_USER_DATA_DIR"] = certificationPath;

		const mod = await import("./appPaths");

		expect(getPath).not.toHaveBeenCalledWith("appData");
		expect(setPath).toHaveBeenCalledWith("userData", certificationPath);
		expect(setPath).toHaveBeenCalledWith(
			"sessionData",
			path.join(certificationPath, "session"),
		);
		expect(mod.USER_DATA_PATH).toBe(certificationPath);
		expect(mod.RECORDINGS_DIR).toBe(path.join(certificationPath, "recordings"));
	});

	it("fails closed when certification mode has no isolated path", async () => {
		process.env["AUREO_CERTIFICATION_MODE"] = "1";

		await expect(import("./appPaths")).rejects.toThrow(
			"AUREO_CERTIFICATION_USER_DATA_DIR is required in certification mode",
		);
		expect(setPath).not.toHaveBeenCalled();
	});

	it("rejects a relative certification userData path", async () => {
		process.env["AUREO_CERTIFICATION_MODE"] = "1";
		process.env["AUREO_CERTIFICATION_USER_DATA_DIR"] = "relative/user-data";

		await expect(import("./appPaths")).rejects.toThrow(
			"AUREO_CERTIFICATION_USER_DATA_DIR must be an absolute path",
		);
		expect(setPath).not.toHaveBeenCalled();
	});
});
