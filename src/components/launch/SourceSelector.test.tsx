import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { DesktopSource } from "./popovers/launchPopoverTypes";
import {
	buildDeviceSource,
	resolveSourceOptionNavigation,
	SourceSelectorContent,
} from "./SourceSelector";

const screen: DesktopSource = {
	id: "screen:1",
	name: "Main display",
	thumbnail: null,
	display_id: "1",
	appIcon: null,
	sourceType: "screen",
};

const secondaryScreen: DesktopSource = {
	id: "screen:2",
	name: "Secondary display",
	thumbnail: null,
	display_id: "2",
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
	it("resolves source-option keyboard navigation without committing a source", () => {
		expect(resolveSourceOptionNavigation("ArrowDown", 0, 3)).toBe(1);
		expect(resolveSourceOptionNavigation("ArrowDown", 2, 3)).toBe(0);
		expect(resolveSourceOptionNavigation("ArrowUp", 0, 3)).toBe(2);
		expect(resolveSourceOptionNavigation("Home", 2, 3)).toBe(0);
		expect(resolveSourceOptionNavigation("End", 0, 3)).toBe(2);
		expect(resolveSourceOptionNavigation("Enter", 0, 3)).toBeNull();
	});

	it("uses listbox options with one selected roving tab stop in screen mode", () => {
		const html = renderToStaticMarkup(
			<I18nProvider>
				<SourceSelectorContent
					screenSources={[screen, secondaryScreen]}
					windowSources={[windowSource]}
					selectedSource={screen.name}
					selectedSourceType="screen"
					onSourceSelect={vi.fn()}
				/>
			</I18nProvider>,
		);

		expect(html.match(/role="radiogroup"/g)).toHaveLength(1);
		expect(html.match(/role="radio"/g)).toHaveLength(4);
		expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*tabindex="0"/);
		expect(html).toMatch(/role="radio"[^>]*aria-checked="false"[^>]*tabindex="-1"/);
		expect(html.match(/role="listbox"/g)).toHaveLength(1);
		expect(html.match(/role="group"/g)).toHaveLength(1);
		expect(html.match(/role="option"/g)).toHaveLength(2);
		expect(html).toMatch(/role="option"[^>]*aria-selected="true"[^>]*tabindex="0"/);
		expect(html).toMatch(/role="option"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
		expect(html).not.toContain("Browser window");
	});

	it("filters to window sources when selectedSourceType is window", () => {
		const html = renderToStaticMarkup(
			<I18nProvider>
				<SourceSelectorContent
					screenSources={[screen]}
					windowSources={[windowSource]}
					selectedSource={windowSource.name}
					selectedSourceType="window"
					onSourceSelect={vi.fn()}
				/>
			</I18nProvider>,
		);

		expect(html).toContain("Browser window");
		expect(html).not.toContain("Main display");
		expect(html.match(/role="option"/g)).toHaveLength(1);
		expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"/);
	});

	it("renders the area action panel without a listbox", () => {
		const html = renderToStaticMarkup(
			<I18nProvider>
				<SourceSelectorContent
					screenSources={[screen]}
					windowSources={[windowSource]}
					selectedSource={screen.name}
					selectedSourceType="area"
					loading={true}
					onSourceSelect={vi.fn()}
				/>
			</I18nProvider>,
		);

		expect(html.match(/role="radio"/g)).toHaveLength(4);
		expect(html.match(/role="listbox"/g)).toBeNull();
		expect(html).toContain("Choose area");
		expect(html).toContain("Select a recording area");
		expect(html).not.toContain('role="option"');
	});

	it("maps browser video inputs into first-class device sources", () => {
		const source = buildDeviceSource(
			{
				deviceId: "capture-card-1",
				groupId: "group-1",
				kind: "videoinput",
				label: "HDMI Capture",
				toJSON: () => ({}),
			},
			0,
		);
		expect(source).toMatchObject({
			id: "device:capture-card-1",
			name: "HDMI Capture",
			sourceType: "device",
			deviceId: "capture-card-1",
		});
	});

	it("renders the device empty state before enumeration returns inputs", () => {
		const html = renderToStaticMarkup(
			<I18nProvider>
				<SourceSelectorContent
					screenSources={[screen]}
					windowSources={[windowSource]}
					selectedSource="HDMI Capture"
					selectedSourceType="device"
					onSourceSelect={vi.fn()}
					open={true}
				/>
			</I18nProvider>,
		);

		expect(html.match(/role="radio"/g)).toHaveLength(4);
		expect(html.match(/role="listbox"/g)).toHaveLength(1);
		expect(html).toContain("No video devices available");
	});
});
