import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ProjectBrowserDialog, { type ProjectLibraryEntry } from "./ProjectBrowserDialog";

const entry: ProjectLibraryEntry = {
	path: "/projects/launch.aureo",
	name: "Launch",
	updatedAt: 1,
	thumbnailPath: null,
	isCurrent: false,
	isInProjectsDirectory: true,
};

describe("ProjectBrowserDialog accessibility", () => {
	it("exposes modal semantics and a visible focus target", () => {
		const html = renderToStaticMarkup(
			<ProjectBrowserDialog
				open
				onOpenChange={vi.fn()}
				entries={[entry]}
				onOpenProject={vi.fn()}
				renderMode="inline"
			/>,
		);

		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-modal="true"');
		expect(html).toContain('data-project-browser-initial-focus="true"');
		expect(html).toContain("focus-visible:ring-2");
	});
});
