import path from "node:path";
import { app } from "electron";

// Pin userData before app.setName / productName can redirect settings,
// recordings, extensions, binaries, or diagnostics into an unexpected folder.
const isDev = Boolean(process.env["VITE_DEV_SERVER_URL"]);
const pinnedUserDataPath = path.join(
	app.getPath("appData"),
	isDev ? "Aureo-dev" : "Aureo",
);
app.setPath("userData", pinnedUserDataPath);
app.setPath("sessionData", path.join(pinnedUserDataPath, "session"));

export const USER_DATA_PATH = app.getPath("userData");
export const RECORDINGS_DIR = path.join(USER_DATA_PATH, "recordings");
