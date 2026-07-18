import { type ReactNode, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { HudInteractionContext } from "../contexts/HudInteractionContext";
import { LaunchPopoverCoordinatorContext } from "./LaunchPopoverCoordinator";
import { QualityPresetPopover } from "./QualityPresetPopover";

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

const trigger = <button type="button">Quality</button>;

describe("QualityPresetPopover", () => {
	it("renders all three preset options when open", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="quality">
				<QualityPresetPopover presetId="high" onSelectPreset={vi.fn()} trigger={trigger} />
			</Wrapper>,
		);

		expect(html).toContain('role="menuitemradio"');
		expect(html).toContain("Standard");
		expect(html).toContain("1080p");
		expect(html).toContain("High");
		expect(html).toContain("1440p");
		expect(html).toContain("Ultra");
		expect(html).toContain("4K");
		expect(html).toContain("60");
	});

	it("marks the selected preset as checked", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="quality">
				<QualityPresetPopover
					presetId="standard"
					onSelectPreset={vi.fn()}
					trigger={trigger}
				/>
			</Wrapper>,
		);

		expect(html).toContain('aria-checked="true"');
		expect(html).toContain("Standard");
	});

	it("does not render the menu when disabled even if open is requested", () => {
		const html = renderToStaticMarkup(
			<Wrapper openId="quality">
				<QualityPresetPopover
					presetId="standard"
					onSelectPreset={vi.fn()}
					trigger={trigger}
					disabled
				/>
			</Wrapper>,
		);

		expect(html).not.toContain("1080p");
		expect(html).not.toContain("1440p");
		expect(html).not.toContain("4K");
	});

	it("keeps the popover closed when no explicit open request is made", () => {
		const html = renderToStaticMarkup(
			<Wrapper>
				<QualityPresetPopover presetId="ultra" onSelectPreset={vi.fn()} trigger={trigger} />
			</Wrapper>,
		);

		expect(html).not.toContain("1080p");
		expect(html).not.toContain("1440p");
		expect(html).not.toContain("4K");
	});
});
