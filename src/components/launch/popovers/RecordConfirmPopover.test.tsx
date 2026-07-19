import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../contexts/I18nContext";
import { LaunchPopoverCoordinatorContext } from "./LaunchPopoverCoordinator";

vi.mock("./PopoverScaffold", () => ({
	HudPopover: ({ children, modal }: { children: React.ReactNode; modal?: boolean }) => (
		<div data-modal={String(modal)}>{children}</div>
	),
	HudPopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { RecordConfirmPopover } from "./RecordConfirmPopover";

describe("RecordConfirmPopover", () => {
	it("uses blocking modal behavior for the muted-camera preflight", () => {
		const html = renderToStaticMarkup(
			<I18nProvider>
				<LaunchPopoverCoordinatorContext.Provider
					value={{
						openId: "record-confirm",
						requestOpen: vi.fn(),
						requestClose: vi.fn(),
						isOpen: (id) => id === "record-confirm",
					}}
				>
					<RecordConfirmPopover
						trigger={<button type="button">Record</button>}
						onRecordAnyway={vi.fn()}
					/>
				</LaunchPopoverCoordinatorContext.Provider>
			</I18nProvider>,
		);

		expect(html).toContain('data-modal="true"');
		expect(html).toContain("Microphone is off.");
	});
});
