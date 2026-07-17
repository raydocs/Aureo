import { execFileSync } from "node:child_process";

export default async function removeExtendedAttributesAfterPack(context) {
	if (context.electronPlatformName !== "darwin") return;

	// Finder/resource-fork metadata can be copied into the staged app and makes
	// Apple's codesign reject otherwise valid Electron helper binaries.
	execFileSync("/usr/bin/xattr", ["-cr", context.appOutDir], { stdio: "inherit" });
}
