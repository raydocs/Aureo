import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountdownView } from "./CountdownOverlay";

describe("CountdownView accessibility", () => {
	it("announces timer changes and provides a focusable cancel action", () => {
		const html = renderToStaticMarkup(
			<CountdownView countdown={3} onCancel={() => undefined} />,
		);

		expect(html).toContain('role="status"');
		expect(html).toContain('aria-live="assertive"');
		expect(html).toContain('aria-atomic="true"');
		expect(html).toContain("Recording starts in 3 seconds");
		expect(html).toContain('aria-label="Cancel countdown"');
		expect(html).toContain("autofocus");
	});
});
