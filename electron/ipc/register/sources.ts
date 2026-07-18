import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { app, BrowserWindow, desktopCapturer, ipcMain } from "electron";
import {
	closeAreaSelectorWindow,
	createAreaSelectorWindow,
	getAreaSelectorWindow,
	reassertHudOverlayMousePassthrough,
} from "../../windows";
import { ALLOW_AUREO_WINDOW_CAPTURE } from "../constants";
import {
	getNativeMacWindowSources,
	resolveLinuxWindowBounds,
	resolveMacWindowBounds,
	resolveWindowsWindowBounds,
	stopWindowBoundsCapture,
} from "../cursor/bounds";
import {
	buildAreaSelectedSource,
	type CaptureDisplay,
	type CaptureRect,
	createAreaCaptureLayout,
	getVirtualDesktopBounds,
	isValidAreaSelection,
	windowLocalRectToGlobal,
} from "../recording/areaGeometry";
import { getDisplayBoundsForSource, getDisplayWorkAreaForSource } from "../recording/ffmpeg";
import { selectedSource, setSelectedSource } from "../state";
import type { AreaSelectionResult, SelectedSource } from "../types";
import { getScreen, parseWindowId } from "../utils";
import { getScreenSourceIdForDisplay } from "./sourceMapping";

const execFileAsync = promisify(execFile);
const SOURCE_LIST_CACHE_TTL_MS = 1200;
let sourceListCache:
	| {
			key: string;
			expiresAt: number;
			value: Array<Record<string, unknown>>;
	  }
	| null = null;

function normalizeDesktopSourceName(value: string) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function broadcastSelectedSourceChange() {
	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) {
			window.webContents.send("selected-source-changed", selectedSource);
		}
	}
}

function mapDisplaysToCaptureDisplays(): CaptureDisplay[] {
	return getScreen()
		.getAllDisplays()
		.map((display) => ({
			id: String(display.id),
			bounds: {
				x: display.bounds.x,
				y: display.bounds.y,
				width: display.bounds.width,
				height: display.bounds.height,
			},
			scaleFactor: display.scaleFactor || 1,
		}));
}

function isCaptureRectLike(value: unknown): value is CaptureRect {
	if (!value || typeof value !== "object") {
		return false;
	}
	const rect = value as Partial<CaptureRect>;
	return (
		typeof rect.x === "number" &&
		typeof rect.y === "number" &&
		typeof rect.width === "number" &&
		typeof rect.height === "number"
	);
}

let areaSelectionSession:
	| {
			resolve: (result: AreaSelectionResult) => void;
			window: BrowserWindow;
			desktopBounds: CaptureRect;
	  }
	| null = null;

function settleAreaSelection(result: AreaSelectionResult) {
	const session = areaSelectionSession;
	areaSelectionSession = null;
	if (session) {
		session.resolve(result);
	}
	closeAreaSelectorWindow();
}

export function registerSourceHandlers({
	createEditorWindow,
	createSourceSelectorWindow,
	getSourceSelectorWindow,
}: {
	createEditorWindow: () => void;
	createSourceSelectorWindow: () => BrowserWindow;
	getSourceSelectorWindow: () => BrowserWindow | null;
}) {
	ipcMain.handle("get-sources", async (_, opts) => {
		const cacheKey = JSON.stringify({
			types: opts?.types,
			thumbnailSize: opts?.thumbnailSize,
			fetchWindowIcons: opts?.fetchWindowIcons,
		});
		if (sourceListCache && sourceListCache.key === cacheKey && sourceListCache.expiresAt > Date.now()) {
			return sourceListCache.value;
		}

		const includeScreens = Array.isArray(opts?.types) ? opts.types.includes("screen") : true;
		const includeWindows = Array.isArray(opts?.types) ? opts.types.includes("window") : true;
		const includeWindowIcons = Boolean(opts?.fetchWindowIcons);
		const electronTypes = [
			...(includeScreens ? ["screen" as const] : []),
			...(includeWindows ? ["window" as const] : []),
		];
		const electronSources =
			electronTypes.length > 0
				? await desktopCapturer
						.getSources({
							...opts,
							types: electronTypes,
						})
						.catch((error) => {
							console.warn(
								"desktopCapturer.getSources failed (screen recording permission may be missing):",
								error,
							);
							return [];
						})
				: [];
		const ownWindowNames = new Set(
			[
				app.getName(),
				"Aureo",
				...BrowserWindow.getAllWindows().flatMap((win) => {
					const title = win.getTitle().trim();
					return title ? [title] : [];
				}),
			]
				.map((name) => normalizeDesktopSourceName(name))
				.filter(Boolean),
		);
		const ownAppName = normalizeDesktopSourceName(app.getName());

		const displays = includeScreens
			? [...getScreen().getAllDisplays()].sort(
					(left, right) =>
						left.bounds.x - right.bounds.x ||
						left.bounds.y - right.bounds.y ||
						left.id - right.id,
				)
			: [];
		const primaryDisplayId = includeScreens ? String(getScreen().getPrimaryDisplay().id) : "";
		const electronScreenSourcesByDisplayId = new Map(
			electronSources
				.filter((source) => source.id.startsWith("screen:"))
				.map((source) => [String(source.display_id ?? ""), source] as const),
		);
		// On Linux, desktopCapturer display_id values may not match screen.getAllDisplays() IDs.
		// Keep an ordered list so we can fall back to position-based matching.
		const electronScreenSourcesByIndex = electronSources.filter((source) =>
			source.id.startsWith("screen:"),
		);

		const screenSources = displays.map((display, index) => {
			const displayId = String(display.id);
			const matchedSource =
				electronScreenSourcesByDisplayId.get(displayId) ??
				(electronScreenSourcesByIndex.length === displays.length
					? electronScreenSourcesByIndex[index]
					: undefined);
			const displayName =
				displayId === primaryDisplayId
					? `Screen ${index + 1} (Primary)`
					: `Screen ${index + 1}`;

			return {
				id: getScreenSourceIdForDisplay({
					displayId,
					env: process.env,
					matchedSourceId: matchedSource?.id,
					platform: process.platform,
				}),
				name: displayName,
				originalName: matchedSource?.name ?? displayName,
				display_id: displayId,
				thumbnail: matchedSource?.thumbnail ? matchedSource.thumbnail.toDataURL() : null,
				appIcon: null,
				sourceType: "screen" as const,
			};
		});

		if (process.platform !== "darwin" || !includeWindows) {
			const windowSources = electronSources
				.filter((source) => source.id.startsWith("window:"))
				.filter((source) => {
					const normalizedName = normalizeDesktopSourceName(source.name);
					if (!normalizedName) {
						return true;
					}

					if (ALLOW_AUREO_WINDOW_CAPTURE && normalizedName.includes("aureo")) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (normalizedName === ownName) {
							return false;
						}
					}

					return true;
				})
				.map((source) => ({
					id: source.id,
					name: source.name,
					originalName: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon:
						includeWindowIcons && source.appIcon ? source.appIcon.toDataURL() : null,
					sourceType: "window" as const,
				}));
			const result = [...screenSources, ...windowSources];
			sourceListCache = {
				key: cacheKey,
				expiresAt: Date.now() + SOURCE_LIST_CACHE_TTL_MS,
				value: result,
			};
			return result;
		}

		try {
			const nativeWindowSources = await getNativeMacWindowSources();
			const electronWindowSourceMap = new Map(
				electronSources
					.filter((source) => source.id.startsWith("window:"))
					.map((source) => [source.id, source] as const),
			);

			const mergedWindowSources = nativeWindowSources
				.filter((source) => {
					const normalizedWindowName = normalizeDesktopSourceName(
						source.windowTitle ?? source.name,
					);
					const normalizedAppName = normalizeDesktopSourceName(source.appName ?? "");

					if (
						!ALLOW_AUREO_WINDOW_CAPTURE &&
						normalizedAppName &&
						normalizedAppName === ownAppName
					) {
						return false;
					}

					if (
						ALLOW_AUREO_WINDOW_CAPTURE &&
						(normalizedAppName === "aureo" ||
							normalizedWindowName?.includes("aureo"))
					) {
						return true;
					}

					if (!normalizedWindowName) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (normalizedWindowName === ownName) {
							return false;
						}
					}

					return true;
				})
				.map((source) => {
					const electronWindowSource = electronWindowSourceMap.get(source.id);
					return {
						id: source.id,
						name: source.name,
						originalName: source.name,
						display_id: source.display_id ?? electronWindowSource?.display_id ?? "",
						thumbnail: electronWindowSource?.thumbnail
							? electronWindowSource.thumbnail.toDataURL()
							: null,
						appIcon:
							includeWindowIcons
								? (source.appIcon ??
									(electronWindowSource?.appIcon
										? electronWindowSource.appIcon.toDataURL()
										: null))
								: null,
						appName: source.appName,
						windowTitle: source.windowTitle,
						sourceType: "window" as const,
					};
				});

			const result = [...screenSources, ...mergedWindowSources];
			sourceListCache = {
				key: cacheKey,
				expiresAt: Date.now() + SOURCE_LIST_CACHE_TTL_MS,
				value: result,
			};
			return result;
		} catch (error) {
			console.warn("Falling back to Electron window enumeration on macOS:", error);

			const windowSources = electronSources
				.filter((source) => source.id.startsWith("window:"))
				.filter((source) => {
					const normalizedName = normalizeDesktopSourceName(source.name);
					if (!normalizedName) {
						return true;
					}

					if (ALLOW_AUREO_WINDOW_CAPTURE && normalizedName.includes("aureo")) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (
							normalizedName === ownName ||
							normalizedName.includes(ownName) ||
							ownName.includes(normalizedName)
						) {
							return false;
						}
					}

					return true;
				})
				.map((source) => ({
					id: source.id,
					name: source.name,
					originalName: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon:
						includeWindowIcons && source.appIcon ? source.appIcon.toDataURL() : null,
					sourceType: "window" as const,
				}));

			const result = [...screenSources, ...windowSources];
			sourceListCache = {
				key: cacheKey,
				expiresAt: Date.now() + SOURCE_LIST_CACHE_TTL_MS,
				value: result,
			};
			return result;
		}
	});

	ipcMain.handle("select-source", (_, source: SelectedSource) => {
		setSelectedSource(source);
		broadcastSelectedSourceChange();
		stopWindowBoundsCapture();
		const sourceSelectorWin = getSourceSelectorWindow();
		if (sourceSelectorWin) {
			sourceSelectorWin.close();
		}
		return selectedSource;
	});

	ipcMain.handle("open-area-selector", async (): Promise<AreaSelectionResult> => {
		if (areaSelectionSession) {
			const existing = getAreaSelectorWindow();
			if (existing && !existing.isDestroyed()) {
				existing.focus();
				existing.moveTop();
			}
			// A selection is already in progress; wait for that session.
			return new Promise<AreaSelectionResult>((resolve) => {
				const previousResolve = areaSelectionSession!.resolve;
				areaSelectionSession!.resolve = (result) => {
					previousResolve(result);
					resolve(result);
				};
			});
		}

		const displays = mapDisplaysToCaptureDisplays();
		const desktopBounds = getVirtualDesktopBounds(displays);
		if (!desktopBounds) {
			return { canceled: true, source: null };
		}

		return new Promise<AreaSelectionResult>((resolve) => {
			const window = createAreaSelectorWindow(desktopBounds);
			areaSelectionSession = {
				resolve,
				window,
				desktopBounds,
			};

			window.once("closed", () => {
				// Escape / OS close without an explicit cancel IPC still cancels.
				if (areaSelectionSession?.window === window) {
					settleAreaSelection({ canceled: true, source: null });
				}
			});
		});
	});

	ipcMain.handle("cancel-area-selection", () => {
		if (!areaSelectionSession) {
			closeAreaSelectorWindow();
			return { canceled: true as const, source: null };
		}
		settleAreaSelection({ canceled: true, source: null });
		return { canceled: true as const, source: null };
	});

	ipcMain.handle("complete-area-selection", (_, payload: { localRect?: CaptureRect }) => {
		const session = areaSelectionSession;
		if (!session) {
			return { canceled: true as const, source: null, error: "No active area selection." };
		}

		if (!isCaptureRectLike(payload?.localRect)) {
			return {
				canceled: true as const,
				source: null,
				error: "Area selection rect is required.",
			};
		}

		const globalRect = windowLocalRectToGlobal(session.desktopBounds, payload.localRect);
		if (!isValidAreaSelection(globalRect)) {
			// Too small: keep overlay open so the user can reselect.
			return {
				canceled: false as const,
				source: null,
				error: "Selection is too small. Drag a larger region or press Escape to cancel.",
			};
		}

		const displays = mapDisplaysToCaptureDisplays();
		const layout = createAreaCaptureLayout(globalRect, displays);
		if (!layout) {
			return {
				canceled: false as const,
				source: null,
				error: "Selection is outside the available displays. Try again.",
			};
		}

		const source = buildAreaSelectedSource(layout);
		setSelectedSource(source);
		broadcastSelectedSourceChange();
		stopWindowBoundsCapture();
		settleAreaSelection({ canceled: false, source });
		return { canceled: false as const, source };
	});

	ipcMain.handle("show-source-highlight", async (_, source: SelectedSource) => {
		try {
			const isWindow = source.id?.startsWith("window:");
			const windowId = isWindow ? parseWindowId(source.id) : null;

			// ── 1. Bring window to front ──
			if (isWindow && process.platform === "darwin") {
				const rawAppName = source.appName || source.name?.split(" — ")[0]?.trim();
				const appName =
					rawAppName && /^[\w .&()+'-]{1,64}$/.test(rawAppName) ? rawAppName : null;
				if (appName) {
					try {
						await execFileAsync(
							"osascript",
							[
								"-e",
								"on run argv",
								"-e",
								"tell application (item 1 of argv) to activate",
								"-e",
								"end run",
								"--",
								appName,
							],
							{ timeout: 2000 },
						);
						await new Promise((resolve) => setTimeout(resolve, 350));
					} catch {
						/* ignore */
					}
				}
			} else if (windowId && process.platform === "linux") {
				try {
					await execFileAsync("wmctrl", ["-i", "-a", `0x${windowId.toString(16)}`], {
						timeout: 1500,
					});
				} catch {
					try {
						await execFileAsync("xdotool", ["windowactivate", String(windowId)], {
							timeout: 1500,
						});
					} catch {
						/* not available */
					}
				}
				await new Promise((resolve) => setTimeout(resolve, 250));
			}

			// ── 2. Resolve bounds ──
			let bounds: { x: number; y: number; width: number; height: number } | null = null;

			if (source.id?.startsWith("screen:")) {
				bounds =
					process.platform === "darwin"
						? getDisplayWorkAreaForSource(source)
						: getDisplayBoundsForSource(source);
			} else if (isWindow) {
				if (process.platform === "darwin") {
					bounds = await resolveMacWindowBounds(source);
				} else if (process.platform === "win32") {
					bounds = await resolveWindowsWindowBounds(source);
				} else if (process.platform === "linux") {
					bounds = await resolveLinuxWindowBounds(source);
				}
			}

			if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
				bounds = getDisplayBoundsForSource(source);
			}

			if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
				const primaryBounds = getScreen().getPrimaryDisplay().bounds;
				if (primaryBounds.width <= 0 || primaryBounds.height <= 0) {
					return { success: false };
				}
				bounds = primaryBounds;
			}

			const resolvedBounds = bounds;

			// ── 3. Show traveling wave highlight ──
			// On macOS, screen highlights use workArea and no outward padding —
			// macOS clamps window positions below the menu bar so outward
			// padding only works on the left/top while right/bottom run off-screen.
			const isScreen = source.id?.startsWith("screen:");
			const isMacScreen = isScreen && process.platform === "darwin";
			const pad = isMacScreen ? 0 : 6;
			const highlightWin = new BrowserWindow({
				x: resolvedBounds.x - pad,
				y: resolvedBounds.y - pad,
				width: resolvedBounds.width + pad * 2,
				height: resolvedBounds.height + pad * 2,
				frame: false,
				transparent: true,
				alwaysOnTop: true,
				skipTaskbar: true,
				hasShadow: false,
				resizable: false,
				focusable: false,
				webPreferences: { nodeIntegration: false, contextIsolation: true },
			});

			highlightWin.setIgnoreMouseEvents(true);

			const borderRadius = isMacScreen ? 0 : 10;
			const glowInset = isMacScreen ? 0 : -4;
			const glowRadius = isMacScreen ? 0 : 14;
			const glowPad = isMacScreen ? 3 : 6;

			const html = `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;overflow:hidden;width:100vw;height:100vh}

.border-wrap{
  position:fixed;inset:0;border-radius:${borderRadius}px;padding:3px;
  background:conic-gradient(from var(--angle,0deg),
    transparent 0%,
    transparent 60%,
    rgba(99,96,245,.15) 70%,
    rgba(99,96,245,.9) 80%,
    rgba(123,120,255,1) 85%,
    rgba(99,96,245,.9) 90%,
    rgba(99,96,245,.15) 95%,
    transparent 100%
  );
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  animation:spin 1.2s linear forwards, fadeAll 1.6s ease-out forwards;
}

.glow-wrap{
  position:fixed;inset:${glowInset}px;border-radius:${glowRadius}px;padding:${glowPad}px;
  background:conic-gradient(from var(--angle,0deg),
    transparent 0%,
    transparent 65%,
    rgba(99,96,245,.3) 78%,
    rgba(123,120,255,.5) 85%,
    rgba(99,96,245,.3) 92%,
    transparent 100%
  );
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  filter:blur(8px);
  animation:spin 1.2s linear forwards, fadeAll 1.6s ease-out forwards;
}

@property --angle{
  syntax:'<angle>';
  initial-value:0deg;
  inherits:false;
}

@keyframes spin{
  0%{--angle:0deg}
  100%{--angle:360deg}
}

@keyframes fadeAll{
  0%,60%{opacity:1}
  100%{opacity:0}
}
</style></head><body>
<div class="glow-wrap"></div>
<div class="border-wrap"></div>
</body></html>`

			try {
				await highlightWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
			} catch (loadError) {
				if (!highlightWin.isDestroyed()) {
					highlightWin.close()
				}
				throw loadError
			}

			// The highlight window appearing (even with focusable:false) can corrupt
			// the WS_EX_TRANSPARENT flag on the HUD on Windows 11+, breaking hover
			// detection until the user moves their mouse over the bar again.
			// Re-assert passthrough immediately so click-through is restored at once.
			reassertHudOverlayMousePassthrough();

			const highlightCloseTimer = setTimeout(() => {
				if (!highlightWin.isDestroyed()) highlightWin.close()
			}, 1700)

			highlightWin.on("closed", () => {
				clearTimeout(highlightCloseTimer);
				// Re-assert once more when the window is actually destroyed so the
				// native flag is clean regardless of timing.
				reassertHudOverlayMousePassthrough();
			});

			return { success: true }
    } catch (error) {
      console.error('Failed to show source highlight:', error)
      return { success: false }
    }
  })

  ipcMain.handle('get-selected-source', () => {
    return selectedSource
  })

  ipcMain.handle('open-source-selector', () => {
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.focus()
      return
    }
    createSourceSelectorWindow()
  })
  ipcMain.handle('switch-to-editor', () => {
    console.log('[switch-to-editor] Opening editor window')
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin && !sourceSelectorWin.isDestroyed()) {
      sourceSelectorWin.close()
    }
    createEditorWindow()
  })

}
