import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EditorTransport } from "./EditorTransport";

function renderTransport(overrides: Partial<React.ComponentProps<typeof EditorTransport>> = {}) {
	return renderToStaticMarkup(
		<EditorTransport
			ariaLabel="Preview transport"
			currentTimeLabel="00:04"
			durationLabel="01:20"
			isPlaying={false}
			playLabel="Play"
			pauseLabel="Pause"
			skipBackLabel="Skip back"
			skipForwardLabel="Skip forward"
			splitClipLabel="Split clip"
			zoomToPlayheadLabel="Zoom to playhead"
			onSkipBack={vi.fn()}
			onTogglePlayPause={vi.fn()}
			onSkipForward={vi.fn()}
			onSplitClip={vi.fn()}
			onZoomToPlayhead={vi.fn()}
			{...overrides}
		/>,
	);
}

describe("EditorTransport", () => {
	it("renders an accessible floating playback toolbar", () => {
		const html = renderTransport();

		expect(html).toContain('role="toolbar"');
		expect(html).toContain('aria-label="Preview transport"');
		expect(html).toContain('aria-label="Play"');
		expect(html).toContain('aria-label="Skip back"');
		expect(html).toContain('aria-label="Skip forward"');
		expect(html).toContain('aria-label="Split clip"');
		expect(html).toContain('aria-label="Zoom to playhead"');
		expect(html).toContain("00:04");
		expect(html).toContain("01:20");
	});

	it("announces pause while playing and disables unavailable splitting", () => {
		const html = renderTransport({ isPlaying: true, canSplit: false });

		expect(html).toContain('aria-label="Pause"');
		expect(html).toContain('aria-pressed="true"');
		expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Split clip"/);
	});
});
