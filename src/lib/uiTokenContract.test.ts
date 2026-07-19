import fs from "node:fs";
import path from "node:path";
import { parse, type Root } from "postcss";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const indexCss = fs.readFileSync(path.join(root, "src/index.css"), "utf8");
const launchThemeCss = fs.readFileSync(
	path.join(root, "src/components/launch/launchTheme.css"),
	"utf8",
);
const launchWindowCss = fs.readFileSync(
	path.join(root, "src/components/launch/LaunchWindow.module.css"),
	"utf8",
);
const sourceSelectorCss = fs.readFileSync(
	path.join(root, "src/components/launch/SourceSelector.css"),
	"utf8",
);
const indexCssRoot = parse(indexCss);
const launchThemeCssRoot = parse(launchThemeCss);

function declarationsForSelector(cssRoot: Root, selector: string): Map<string, string> {
	const declarations = new Map<string, string>();
	cssRoot.walkRules((rule) => {
		if (!rule.selectors.includes(selector)) return;
		rule.walkDecls((declaration) => {
			declarations.set(declaration.prop, declaration.value);
		});
	});
	expect(declarations.size, `Missing selector: ${selector}`).toBeGreaterThan(0);
	return declarations;
}

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
			"--ui-motion-duration-instant",
			"--ui-motion-duration-fast",
			"--ui-motion-duration-normal",
			"--ui-motion-duration-slow",
		]) {
			expect(indexCss).toContain(`${token}:`);
		}
	});

	it("maps every launch appearance to the shared semantic contract", () => {
		const light = declarationsForSelector(launchThemeCssRoot, ".launch-theme");
		const dark = declarationsForSelector(launchThemeCssRoot, ".dark .launch-theme");
		const hud = declarationsForSelector(
			launchThemeCssRoot,
			".hud-overlay-window .launch-theme",
		);

		for (const [property, value] of [
			["--launch-surface", "var(--ui-material-floating)"],
			["--launch-panel", "var(--ui-material-panel)"],
			["--launch-text", "var(--ui-label-primary)"],
			["--launch-hover", "var(--ui-control-hover)"],
			["--launch-selected", "var(--ui-control-selected)"],
			["--launch-border", "var(--ui-separator)"],
		] as const) {
			expect(light.get(property)).toBe(value);
		}

		for (const appearance of [dark, hud]) {
			for (const property of [
				"--ui-material-panel",
				"--ui-label-primary",
				"--ui-separator",
				"--ui-control-hover",
				"--ui-control-pressed",
				"--ui-control-selected",
				"--ui-focus-ring",
			]) {
				expect(appearance.has(property)).toBe(true);
			}
		}
		expect(dark.get("--ui-focus-ring")).toBe("#2563eb");
		expect(hud.get("--ui-focus-ring")).toBe("#ffffff");
	});

	it("redeclares dependent semantic aliases at the nested transparency scope", () => {
		const reducedTransparency = declarationsForSelector(
			indexCssRoot,
			'[data-reduce-transparency="true"]',
		);
		expect(reducedTransparency.get("--ui-material-floating")).toBe(
			"hsl(var(--surface-glass-solid))",
		);
		expect(reducedTransparency.get("--ui-separator")).toBe("hsl(var(--hairline-strong))");

		const reducedTransparencyLaunch = declarationsForSelector(
			launchThemeCssRoot,
			'.launch-theme[data-reduce-transparency="true"]',
		);
		expect(reducedTransparencyLaunch.get("--ui-material-floating")).toBe(
			"var(--ui-material-opaque)",
		);
		expect(reducedTransparencyLaunch.get("--ui-separator")).toBe("var(--ui-separator-strong)");
	});

	it("uses the shared state roles in HUD controls and source choices", () => {
		for (const css of [launchWindowCss, sourceSelectorCss]) {
			expect(css).toContain("var(--ui-control-hover)");
			expect(css).toContain("var(--ui-control-pressed)");
			expect(css).toContain("var(--ui-control-selected)");
			expect(css).toContain("var(--ui-focus-ring)");
			expect(css).toContain("var(--ui-label-primary)");
			expect(css).toContain("var(--ui-label-secondary)");
			expect(css).toContain("var(--ui-separator-strong)");
		}
		expect(launchWindowCss).toContain("var(--ui-control-disabled-opacity)");
	});
});
