import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AreaSelectorOverlay } from "./AreaSelectorOverlay";

describe("AreaSelectorOverlay accessibility", () => {
	it("offers a keyboard form alternative to pointer dragging", () => {
		const html = renderToStaticMarkup(<AreaSelectorOverlay />);

		expect(html).toContain("Choose area with keyboard");
		expect(html).toContain('aria-label="Selection left"');
		expect(html).toContain('aria-label="Selection top"');
		expect(html).toContain('aria-label="Selection width"');
		expect(html).toContain('aria-label="Selection height"');
	});
});
