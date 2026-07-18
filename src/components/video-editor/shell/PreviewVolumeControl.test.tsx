import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PreviewVolumeControl } from "./PreviewVolumeControl";

function renderVolume(value: number) {
	return renderToStaticMarkup(
		<PreviewVolumeControl
			value={value}
			onChange={vi.fn()}
			volumeLabel="Preview volume"
			muteLabel="Mute preview"
			unmuteLabel="Unmute preview"
		/>,
	);
}

describe("PreviewVolumeControl", () => {
	it("labels the slider and announces the normalized percentage", () => {
		const html = renderVolume(0.42);

		expect(html).toContain('aria-label="Preview volume"');
		expect(html).toContain('aria-valuetext="42%"');
		expect(html).toContain('aria-label="Mute preview"');
		expect(html).toContain("42%");
	});

	it("clamps invalid values and exposes the unmute state", () => {
		const html = renderVolume(-2);

		expect(html).toContain('value="0"');
		expect(html).toContain('aria-label="Unmute preview"');
		expect(html).toContain('aria-pressed="true"');
	});

	it("normalizes non-finite and over-range values", () => {
		expect(renderVolume(Number.NaN)).toContain('aria-valuetext="0%"');
		expect(renderVolume(Number.POSITIVE_INFINITY)).toContain('aria-valuetext="0%"');
		expect(renderVolume(4)).toContain('aria-valuetext="100%"');
	});
});
