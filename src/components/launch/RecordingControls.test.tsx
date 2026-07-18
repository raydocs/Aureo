import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { RecordingControls } from "./RecordingControls";

function renderControls(paused = false) {
	return renderToStaticMarkup(
		<I18nProvider>
			<RecordingControls
				paused={paused}
				microphoneEnabled
				elapsed={65}
				onToggleMicrophone={vi.fn()}
				onPauseResume={vi.fn()}
				onStopRecording={vi.fn()}
				onCancelRecording={vi.fn()}
				onHideHud={vi.fn()}
				formatTime={(seconds) => `${seconds}s`}
			/>
		</I18nProvider>,
	);
}

describe("RecordingControls", () => {
	it("exposes distinct stop, cancel, and hide HUD actions", () => {
		const html = renderControls();

		expect(html).toContain('aria-label="Stop"');
		expect(html).toContain('aria-label="Cancel"');
		expect(html).toContain('aria-label="Hide HUD"');
		expect(html).toContain("65s");
	});

	it("exposes the paused state and resume action", () => {
		const html = renderControls(true);

		expect(html).toContain("PAUSED");
		expect(html).toContain('aria-label="Resume"');
		expect(html).toContain('aria-pressed="true"');
	});
});
