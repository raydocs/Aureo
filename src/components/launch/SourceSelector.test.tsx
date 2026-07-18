import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { DesktopSource } from "./popovers/launchPopoverTypes";
import { SourceSelectorContent } from "./SourceSelector";

const screen: DesktopSource = {
	id: "screen:1",
	name: "Main display",
	thumbnail: null,
	display_id: "1",
	appIcon: null,
	sourceType: "screen",
};

const windowSource: DesktopSource = {
	id: "window:1",
	name: "Browser",
	windowTitle: "Browser window",
	thumbnail: null,
	display_id: "",
	appIcon: null,
	sourceType: "window",
};

describe("SourceSelectorContent", () => {
	it("uses listbox options with one selected roving tab stop", () => {
		const html = renderToStaticMarkup(
			<I18nProvider>
				<SourceSelectorContent
					screenSources={[screen]}
					windowSources={[windowSource]}
					selectedSource={screen.name}
					onSourceSelect={vi.fn()}
				/>
			</I18nProvider>,
		);

		expect(html.match(/role="listbox"/g)).toHaveLength(1);
		expect(html.match(/role="group"/g)).toHaveLength(2);
		expect(html.match(/role="option"/g)).toHaveLength(2);
		expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"/);
		expect(html).toMatch(/aria-selected="false"[^>]*tabindex="-1"/);
	});
});
