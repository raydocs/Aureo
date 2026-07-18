import { useEffect, useState } from "react";
import { CountdownOverlay } from "./components/countdown/CountdownOverlay";
import { LaunchWindow } from "./components/launch/LaunchWindow";
import { SourceSelector } from "./components/launch/SourceSelector";
import { UpdateToastWindow } from "./components/launch/UpdateToastWindow";
import { GlassSurface } from "./components/ui/glass-surface";
import { Toaster } from "./components/ui/sonner";
import { ShortcutsConfigDialog } from "./components/video-editor/ShortcutsConfigDialog";
import VideoEditor from "./components/video-editor/VideoEditor";
import { useI18n } from "./contexts/I18nContext";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { loadAllCustomFonts } from "./lib/customFonts";

export default function App() {
	const [windowType, setWindowType] = useState("");
	const { t } = useI18n();
	const isMacOS = /mac/i.test(navigator.platform);
	const appIconSrc = "/app-icons/aureo-128.png";

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const type = params.get("windowType") || "";
		setWindowType(type);
		document.documentElement.dataset.windowType = type;

		if (
			type === "hud-overlay" ||
			type === "source-selector" ||
			type === "countdown" ||
			(type === "update-toast" && isMacOS)
		) {
			document.body.style.background = "transparent";
			document.documentElement.style.background = "transparent";
			document.getElementById("root")?.style.setProperty("background", "transparent");
		}

		if (type === "hud-overlay") {
			document.documentElement.classList.add("hud-overlay-window");
			document.body.classList.add("hud-overlay-window");
			document.getElementById("root")?.classList.add("hud-overlay-window");
			window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
		} else if (type === "update-toast") {
			document.documentElement.style.overflow = "visible";
			document.body.style.overflow = "visible";
			document.getElementById("root")?.style.setProperty("overflow", "visible");
		}

		loadAllCustomFonts().catch((error) => {
			console.error("Failed to load custom fonts:", error);
		});
	}, [isMacOS]);

	useEffect(() => {
		document.title =
			windowType === "editor" ? t("app.editorTitle", "Aureo Editor") : t("app.name", "Aureo");
	}, [windowType, t]);

	switch (windowType) {
		case "hud-overlay":
			return (
				<>
					<LaunchWindow />
					<Toaster className="pointer-events-auto" />
				</>
			);
		case "source-selector":
			return <SourceSelector />;
		case "countdown":
			return <CountdownOverlay />;
		case "update-toast":
			return <UpdateToastWindow />;
		case "editor":
			return (
				<ShortcutsProvider>
					<VideoEditor />
					<ShortcutsConfigDialog />
				</ShortcutsProvider>
			);
		default:
			return (
				<main className="flex h-full w-full items-center justify-center bg-surface-content text-surface-foreground">
					<GlassSurface
						variant="regular"
						padding="comfortable"
						className="flex items-center gap-4 rounded-2xl"
					>
						<img
							src={appIconSrc}
							alt=""
							className="h-12 w-12 rounded-xl shadow-aureo-1"
						/>
						<div>
							<h1 className="text-xl font-semibold tracking-tight">
								{t("app.name", "Aureo")}
							</h1>
							<p className="text-sm text-surface-foreground-muted">
								{t("app.subtitle", "Screen recording and editing")}
							</p>
						</div>
					</GlassSurface>
				</main>
			);
	}
}
