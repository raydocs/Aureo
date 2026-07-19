import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
	getInspectorBackgroundIsolationProps,
	InspectorBackground,
	ResponsiveInspector,
	resolveInspectorKeyboardAction,
	resolveInspectorTabTarget,
	shouldHandleInspectorKeyboardEvent,
} from "./ResponsiveInspector";

function renderInspector({ isDocked, open }: { isDocked: boolean; open: boolean }) {
	const isModalOpen = !isDocked && open;
	return renderToStaticMarkup(
		<div>
			<div
				data-inspector-workspace="true"
				{...getInspectorBackgroundIsolationProps(isModalOpen)}
			>
				<button type="button">Save</button>
			</div>
			<ResponsiveInspector
				isDocked={isDocked}
				open={open}
				label="Inspector"
				closeLabel="Close inspector"
				onDismiss={vi.fn()}
				sectionSwitcher={<button type="button">Video settings</button>}
			>
				<div data-settings-panel-mount="stable">Settings panel</div>
			</ResponsiveInspector>
		</div>,
	);
}

describe("ResponsiveInspector", () => {
	it.each([
		{ isDocked: true, open: false, mode: "docked" },
		{ isDocked: false, open: false, mode: "closed" },
		{ isDocked: false, open: true, mode: "modal" },
	])("keeps one panel ownership boundary in $mode mode", ({ isDocked, open, mode }) => {
		const html = renderInspector({ isDocked, open });

		expect(html.match(/data-settings-panel-mount="stable"/g)).toHaveLength(1);
		expect(html).toContain(`data-inspector-mode="${mode}"`);
	});

	it("renders the narrow Inspector as a modal sheet with an inert workspace", () => {
		const html = renderInspector({ isDocked: false, open: true });

		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-modal="true"');
		expect(html).toContain('aria-label="Inspector"');
		expect(html).toContain("data-inspector-backdrop");
		expect(html).toMatch(/data-inspector-workspace="true"[^>]*inert=""/);
		expect(html).toContain('data-inspector-initial-focus="true"');
	});

	it("does not isolate the workspace while docked", () => {
		const html = renderInspector({ isDocked: true, open: false });

		expect(html).toContain('role="complementary"');
		expect(html).not.toContain('aria-modal="true"');
		expect(html).not.toMatch(/data-inspector-workspace="true"[^>]*inert=/);
		expect(html).not.toContain("data-inspector-backdrop");
	});

	it("wraps Tab and Shift+Tab at the modal boundaries", () => {
		const first = { id: "first" };
		const middle = { id: "middle" };
		const last = { id: "last" };
		const outside = { id: "outside" };
		const focusableElements = [first, middle, last];

		expect(resolveInspectorTabTarget(focusableElements, last, false)).toBe(first);
		expect(resolveInspectorTabTarget(focusableElements, first, true)).toBe(last);
		expect(resolveInspectorTabTarget(focusableElements, outside, false)).toBe(first);
		expect(resolveInspectorTabTarget(focusableElements, outside, true)).toBe(last);
		expect(resolveInspectorTabTarget(focusableElements, middle, false)).toBeNull();
	});

	it("reserves Escape for modal dismissal without intercepting other keys", () => {
		expect(resolveInspectorKeyboardAction("Escape")).toBe("dismiss");
		expect(resolveInspectorKeyboardAction("Tab")).toBe("contain");
		expect(resolveInspectorKeyboardAction("ArrowDown")).toBeNull();
	});

	it("leaves keyboard ownership with a portaled overlay outside the sheet", () => {
		const inside = { id: "inside" } as unknown as EventTarget;
		const portaled = { id: "portaled" } as unknown as EventTarget;
		const panel = { contains: (target: EventTarget) => target === inside };

		expect(shouldHandleInspectorKeyboardEvent(panel, inside)).toBe(true);
		expect(shouldHandleInspectorKeyboardEvent(panel, portaled)).toBe(false);
		expect(shouldHandleInspectorKeyboardEvent(panel, null)).toBe(false);
	});

	it("can isolate auxiliary background layers while the sheet is modal", () => {
		const html = renderToStaticMarkup(
			<InspectorBackground data-testid="notifications" isolated>
				<button type="button">Show in Folder</button>
			</InspectorBackground>,
		);

		expect(html).toContain('data-testid="notifications"');
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain('inert=""');
	});
});
