import { describe, expect, it } from "vitest";

import { ExtensionHost } from "./extensionHost";
import type { ExtensionInfo } from "./types";

describe("ExtensionHost v1 trust policy", () => {
	it("rejects direct activation of a non-builtin executable extension", async () => {
		const host = new ExtensionHost();
		const extension: ExtensionInfo = {
			manifest: {
				id: "com.example.untrusted",
				name: "Untrusted",
				version: "1.0.0",
				description: "",
				main: "index.js",
				permissions: [],
			},
			status: "active",
			path: "/tmp/untrusted-extension",
			builtin: false,
		};

		await expect(
			host.activateExtension(
				extension,
				"data:text/javascript,export async function activate() {}",
			),
		).rejects.toThrow("non-builtin extensions are disabled");
		expect(host.getActiveExtensions()).toEqual([]);
	});
});
