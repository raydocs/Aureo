import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ExportSettingsMenu } from "./ExportSettingsMenu";

vi.mock("@/contexts/I18nContext", () => ({
	useScopedT: () => (key: string, fallback?: string, vars?: Record<string, string | number>) =>
		fallback ?? (vars?.format ? `Export ${vars.format}` : key),
}));

const defaultProps: React.ComponentProps<typeof ExportSettingsMenu> = {
	exportFormat: "mp4",
	exportQuality: "good",
	exportEncodingMode: "balanced",
	exportVideoCodec: "h264",
	mp4FrameRate: 30,
	gifFrameRate: 15,
	gifLoop: true,
	gifSizePreset: "medium",
	gifOutputDimensions: { width: 960, height: 540 },
};

function renderMenu(overrides: Partial<React.ComponentProps<typeof ExportSettingsMenu>> = {}) {
	return renderToStaticMarkup(<ExportSettingsMenu {...defaultProps} {...overrides} />);
}

describe("ExportSettingsMenu", () => {
	it("uses semantic primary styling for the selected format and export action", () => {
		const html = renderMenu();

		expect(html).toContain('role="group"');
		expect(html).toContain('aria-label="Export format"');
		expect(html).toContain('aria-label="Video codec"');
		expect(html).toContain('aria-pressed="true"');
		expect(html).toContain("border-hairline");
		expect(html).toContain("bg-surface-panel");
		expect(html).toContain("border-primary/50");
		expect(html).toContain("bg-primary");
		expect(html).toContain("text-primary-foreground");
		expect(html).not.toContain("#2563EB");
	});

	it("labels the GIF loop switch", () => {
		const html = renderMenu({ exportFormat: "gif" });

		expect(html).toContain('aria-label="export.loop"');
		expect(html).toContain('role="switch"');
	});
});
