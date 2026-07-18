import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EditorHeaderLayout } from "./EditorHeaderLayout";

describe("EditorHeaderLayout", () => {
	it("renders a 52px draggable header with three non-draggable command slots", () => {
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
		expect(html).toContain("h-[52px]");
		expect(html).toContain("grid-cols-[auto_minmax(150px,1fr)_auto]");
		expect(html).not.toContain("backdrop-blur-md");
		expect(html).toContain("-webkit-app-region:drag");
		expect(html.match(/-webkit-app-region:no-drag/g)).toHaveLength(3);
		expect(html).toContain('data-editor-header-slot="leading"');
		expect(html).toContain('data-editor-header-slot="identity"');
		expect(html).toContain('data-editor-header-slot="actions"');
	});

	it("left-aligns project identity next to the leading project actions", () => {
		const html = renderToStaticMarkup(
			<EditorHeaderLayout
				ariaLabel="Editor commands"
				leading={<div>Leading</div>}
				identity={<div>Identity</div>}
				actions={<div>Actions</div>}
			/>,
		);

		const identityMatch = html.match(
			/<div[^>]*data-editor-header-slot="identity"[^>]*>.*?<\/div>/,
		);
		expect(identityMatch?.[0]).toContain("justify-self-start");
	});
});
