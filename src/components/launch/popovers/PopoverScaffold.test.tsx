import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DropdownItem } from "./PopoverScaffold";

describe("DropdownItem", () => {
	it("renders ordinary actions without a checked state", () => {
		const html = renderToStaticMarkup(
			<DropdownItem icon={<span />} onClick={vi.fn()}>
				Open project
			</DropdownItem>,
		);

		expect(html).toContain('role="menuitem"');
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
