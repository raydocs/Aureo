import { type ReactNode, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { HudInteractionContext } from "../contexts/HudInteractionContext";
import { LaunchPopoverCoordinatorContext } from "./LaunchPopoverCoordinator";
import { SourcePopover } from "./SourcePopover";

function MockCoordinator({
	children,
	openId = null,
}: {
	children: ReactNode;
	openId?: string | null;
}) {
	const value = useMemo(
		() => ({
			openId,
			requestOpen: vi.fn(),
			requestClose: vi.fn(),
			isOpen: (id: string) => openId === id,
		}),
		[openId],
	);
	return (
		<LaunchPopoverCoordinatorContext.Provider value={value}>
			{children}
		</LaunchPopoverCoordinatorContext.Provider>
	);
}

function Wrapper({ children, openId }: { children: React.ReactNode; openId?: string | null }) {
	return (
		<I18nProvider>
			<HudInteractionContext.Provider
				value={{ onMouseEnter: vi.fn(), onMouseLeave: vi.fn() }}
			>
				<MockCoordinator openId={openId}>{children}</MockCoordinator>
			</HudInteractionContext.Provider>
		</I18nProvider>
	);
}

const baseProps = {
	selectedSource: "Main display",
	selectedSourceType: "screen" as const,
	onSourceSelect: vi.fn(),
};

const trigger = (
	<div role="group" aria-label="Source modes">
		<button type="button" aria-label="Display">
			Display
		</button>
		<button type="button" aria-label="Window">
			Window
		</button>
		<button type="button" aria-label="Area">
			Area
		</button>
		<button type="button" aria-label="Device">
			Device
		</button>
	</div>
);

describe("SourcePopover", () => {
	it("renders the provided trigger unchanged", () => {
		const html = renderToStaticMarkup(
			<Wrapper>
				<SourcePopover {...baseProps} trigger={trigger} />
			</Wrapper>,
		);

		expect(html).toContain('aria-label="Display"');
		expect(html).toContain('aria-label="Window"');
		expect(html).toContain('aria-label="Area"');
		expect(html).toContain('aria-label="Device"');
		expect(html).toContain('aria-expanded="false"');
	});

	it("opens the popover focused on the requested initial mode without selecting a fake source", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="sources">
				<SourcePopover {...baseProps} initialMode="device" trigger={trigger} />
			</Wrapper>,
		);

		expect(html).toContain('role="radiogroup"');
		expect(html.match(/role="radio"/g)).toHaveLength(4);
		expect(html).toContain('aria-checked="true"');
		expect(html).toContain("No video devices available");
	});

	it("defaults to the selected source type when no initial mode is provided", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="sources">
				<SourcePopover {...baseProps} trigger={trigger} />
			</Wrapper>,
		);

		expect(html).toContain("Recording source");
		expect(html).toMatch(/data-mode="screen" aria-checked="true"/);
		expect(html).not.toContain("Main display");
	});
});
