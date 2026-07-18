import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorHeaderLayout } from "./EditorHeaderLayout";

describe("EditorHeaderLayout", () => {
	it("renders a draggable header with three non-draggable command slots", () => {
		const html = renderToStaticMarkup(
			<EditorHeaderLayout
				ariaLabel="Editor commands"
				leading={<button type="button">Projects</button>}
				identity={<button type="button">Demo project</button>}
				actions={<button type="button">Export</button>}
			/>,
		);

		expect(html).toContain("<header");
		expect(html).toContain('aria-label="Editor commands"');
		expect(html).toContain('class="glass ');
		expect(html).not.toContain("backdrop-blur-md");
		expect(html).toContain("-webkit-app-region:drag");
		expect(html.match(/-webkit-app-region:no-drag/g)).toHaveLength(3);
		expect(html).toContain('data-editor-header-slot="leading"');
		expect(html).toContain('data-editor-header-slot="identity"');
		expect(html).toContain('data-editor-header-slot="actions"');
	});
});
