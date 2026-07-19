import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HudInteractionContext } from "../contexts/HudInteractionContext";

vi.mock("@radix-ui/react-popover", () => ({
	Root: ({ children, modal }: { children: React.ReactNode; modal?: boolean }) => (
		<div data-modal={String(modal)}>{children}</div>
	),
	Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { HudPopover } from "./PopoverScaffold";

describe("HudPopover", () => {
	const renderPopover = (modal?: boolean) =>
		renderToStaticMarkup(
			<HudInteractionContext.Provider
				value={{ onMouseEnter: vi.fn(), onMouseLeave: vi.fn() }}
			>
				<HudPopover
					open
					onOpenChange={() => undefined}
					modal={modal}
					trigger={<button type="button">Trigger</button>}
				>
					Content
				</HudPopover>
			</HudInteractionContext.Provider>,
		);

	it("uses non-modal behavior by default", () => {
		const html = renderPopover();

		expect(html).toContain('data-modal="false"');
	});

	it("allows blocking surfaces to opt into modal focus behavior", () => {
		const html = renderPopover(true);

		expect(html).toContain('data-modal="true"');
	});
});
