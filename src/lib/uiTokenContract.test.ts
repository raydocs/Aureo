import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const indexCss = fs.readFileSync(path.join(root, "src/index.css"), "utf8");
const launchThemeCss = fs.readFileSync(
	path.join(root, "src/components/launch/launchTheme.css"),
	"utf8",
);

describe("shared UI token contract", () => {
	it("defines semantic material, label, separator, control, focus, and motion aliases", () => {
		for (const token of [
			"--ui-material-panel",
			"--ui-material-elevated",
			"--ui-material-floating",
			"--ui-material-opaque",
			"--ui-label-primary",
			"--ui-label-secondary",
			"--ui-label-tertiary",
			"--ui-separator",
			"--ui-separator-strong",
			"--ui-control-hover",
			"--ui-control-pressed",
			"--ui-control-selected",
			"--ui-control-disabled-opacity",
			"--ui-focus-ring",
			"--ui-motion-duration-fast",
			"--ui-motion-duration-normal",
		]) {
			expect(indexCss).toContain(`${token}:`);
		}
	});

	it("maps launch compatibility variables to the shared semantic contract", () => {
		expect(launchThemeCss).toContain("--launch-surface: var(--ui-material-floating);");
		expect(launchThemeCss).toContain("--launch-panel: var(--ui-material-panel);");
		expect(launchThemeCss).toContain("--launch-text: var(--ui-label-primary);");
		expect(launchThemeCss).toContain("--launch-hover: var(--ui-control-hover);");
		expect(launchThemeCss).toContain("--launch-selected: var(--ui-control-selected);");
		expect(launchThemeCss).toContain("--launch-border: var(--ui-separator);");
	});
});
