import path from "node:path";
import { app } from "electron";

// Pin userData before app.setName / productName can redirect settings,
// recordings, extensions, binaries, or diagnostics into an unexpected folder.
const isDev = Boolean(process.env["VITE_DEV_SERVER_URL"]);
const isCertification = process.env["AUREO_CERTIFICATION_MODE"] === "1";
let pinnedUserDataPath: string;

if (isCertification) {
	const certificationUserDataPath = process.env["AUREO_CERTIFICATION_USER_DATA_DIR"]?.trim();
	if (!certificationUserDataPath) {
		throw new Error("AUREO_CERTIFICATION_USER_DATA_DIR is required in certification mode");
	}
	if (!path.isAbsolute(certificationUserDataPath)) {
		throw new Error("AUREO_CERTIFICATION_USER_DATA_DIR must be an absolute path");
	}
	pinnedUserDataPath = certificationUserDataPath;
} else {
	pinnedUserDataPath = path.join(app.getPath("appData"), isDev ? "Aureo-dev" : "Aureo");
}
app.setPath("userData", pinnedUserDataPath);
app.setPath("sessionData", path.join(pinnedUserDataPath, "session"));

export const USER_DATA_PATH = app.getPath("userData");
export const RECORDINGS_DIR = path.join(USER_DATA_PATH, "recordings");
