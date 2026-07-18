import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SliderControl } from "./SliderControl";

function renderSlider({ label, ariaLabel }: { label: string; ariaLabel?: string }) {
	return renderToStaticMarkup(
		<SliderControl
			label={label}
			ariaLabel={ariaLabel}
			value={20}
			defaultValue={20}
			min={0}
			max={100}
			step={1}
			onChange={vi.fn()}
			formatValue={(value) => `${value}%`}
			parseInput={(text) => Number(text.replace(/%$/, ""))}
		/>,
	);
}

describe("SliderControl", () => {
	it("uses a dedicated accessible label when the visual label is intentionally empty", () => {
		const html = renderSlider({ label: "", ariaLabel: "Padding" });

		expect(html).toContain('role="slider"');
		expect(html).toContain('aria-label="Padding"');
		expect(html).toContain('aria-valuemin="0"');
		expect(html).toContain('aria-valuemax="100"');
		expect(html).toContain('aria-valuenow="20"');
		expect(html).toContain('aria-valuetext="20%"');
	});

	it("uses the visual label as the accessible name by default", () => {
		const html = renderSlider({ label: "Background Blur" });

		expect(html).toContain('aria-label="Background Blur"');
	});
});
