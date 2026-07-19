import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DropdownItem, resolveMenuNavigationIndex } from "./PopoverScaffold";

describe("resolveMenuNavigationIndex", () => {
	it("wraps arrow navigation and supports Home and End", () => {
		expect(resolveMenuNavigationIndex(2, 3, "ArrowDown")).toBe(0);
		expect(resolveMenuNavigationIndex(0, 3, "ArrowUp")).toBe(2);
		expect(resolveMenuNavigationIndex(1, 3, "Home")).toBe(0);
		expect(resolveMenuNavigationIndex(1, 3, "End")).toBe(2);
	});

	it("ignores unrelated keys and empty menus", () => {
		expect(resolveMenuNavigationIndex(0, 3, "Tab")).toBeNull();
		expect(resolveMenuNavigationIndex(0, 0, "ArrowDown")).toBeNull();
	});
});

describe("DropdownItem", () => {
	it("renders ordinary actions without a checked state", () => {
		const html = renderToStaticMarkup(
			<DropdownItem icon={<span />} onClick={vi.fn()}>
				Open project
			</DropdownItem>,
		);

		expect(html).toContain('role="menuitem"');
		expect(html).toContain('tabindex="-1"');
		expect(html).not.toContain("aria-checked");
	});

	it("exposes unavailable actions as disabled controls", () => {
		const html = renderToStaticMarkup(
			<DropdownItem icon={<span />} onClick={vi.fn()} disabled>
				Unavailable
			</DropdownItem>,
		);

		expect(html).toContain("disabled");
	});

	it.each([
		"menuitemradio",
		"menuitemcheckbox",
	] as const)("renders %s items with an explicit checked state", (role) => {
		const html = renderToStaticMarkup(
			<DropdownItem role={role} icon={<span />} selected onClick={vi.fn()}>
				Setting
			</DropdownItem>,
		);

		expect(html).toContain(`role="${role}"`);
		expect(html).toContain('aria-checked="true"');
	});
});
