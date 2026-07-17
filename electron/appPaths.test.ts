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

	beforeEach(() => {
		vi.resetModules();
		setPath.mockClear();
		getPath.mockClear();
		pinnedUserData = undefined;
		delete process.env["VITE_DEV_SERVER_URL"];
	});

	afterEach(() => {
		if (originalDevServerUrl === undefined) {
			delete process.env["VITE_DEV_SERVER_URL"];
		} else {
			process.env["VITE_DEV_SERVER_URL"] = originalDevServerUrl;
		}
	});

	it("pins production userData and sessionData under Aureo", async () => {
		const mod = await import("./appPaths");

		expect(setPath).toHaveBeenCalledWith(
			"userData",
			path.join("/mock/appData", "Aureo"),
		);
		expect(setPath).toHaveBeenCalledWith(
			"sessionData",
			path.join("/mock/appData", "Aureo", "session"),
		);
		expect(mod.USER_DATA_PATH).toBe(path.join("/mock/appData", "Aureo"));
		expect(mod.RECORDINGS_DIR).toBe(
			path.join("/mock/appData", "Aureo", "recordings"),
		);
	});

	it("pins dev userData and sessionData under Aureo-dev", async () => {
		process.env["VITE_DEV_SERVER_URL"] = "http://localhost:5173";
		const mod = await import("./appPaths");

		expect(setPath).toHaveBeenCalledWith(
			"userData",
			path.join("/mock/appData", "Aureo-dev"),
		);
		expect(setPath).toHaveBeenCalledWith(
			"sessionData",
			path.join("/mock/appData", "Aureo-dev", "session"),
		);
		expect(mod.USER_DATA_PATH).toBe(path.join("/mock/appData", "Aureo-dev"));
		expect(mod.RECORDINGS_DIR).toBe(
			path.join("/mock/appData", "Aureo-dev", "recordings"),
		);
	});
});
