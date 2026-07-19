import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";
import { Card } from "./card";
import { FloatingToolbar, getToolbarNavigationIndex } from "./floating-toolbar";
import { GlassSurface } from "./glass-surface";

describe("Aureo Design System", () => {
	describe("Button", () => {
		it("renders all variants without breaking existing variants", () => {
			const variants = [
				"default",
				"destructive",
				"outline",
				"secondary",
				"ghost",
				"link",
				"polished",
				"quiet",
				"glass",
				"toolbar",
			] as const;

			for (const variant of variants) {
				const html = renderToStaticMarkup(<Button variant={variant}>Test</Button>);
				expect(html).toContain("Test");
				expect(html).toContain("<button");
			}
		});

		it("supports new size variants and preserves legacy sizing", () => {
			const html = renderToStaticMarkup(<Button size="xl">Large</Button>);
			expect(html).toContain("Large");
			expect(buttonVariants({ size: "lg" })).toContain("px-8");
			expect(buttonVariants({ variant: "toolbar" })).toContain("h-8");
			expect(buttonVariants({ variant: "toolbar" })).toContain("px-2.5");
		});

		it("uses the shared control-state contract", () => {
			const classes = buttonVariants({ variant: "toolbar" });
			expect(classes).toContain("--ui-control-hover");
			expect(classes).toContain("--ui-control-pressed");
			expect(classes).toContain("--ui-control-selected");
			expect(classes).toContain("--ui-control-disabled-opacity");
			expect(classes).toContain("--ui-focus-ring");
		});

		it("composes className with CVA", () => {
			const className = buttonVariants({ className: "custom-class" });
			expect(className).toContain("custom-class");
			expect(className).toContain("rounded-md");
		});

		it("forwards data attributes", () => {
			const html = renderToStaticMarkup(<Button data-testid="btn">Ref</Button>);
			expect(html).toContain('data-testid="btn"');
		});
	});

	describe("Card", () => {
		it("renders default variant and remains backwards compatible", () => {
			const html = renderToStaticMarkup(<Card>Content</Card>);
			expect(html).toContain('data-card-variant="default"');
			expect(html).toContain("Content");
		});

		it("renders surface variant with design tokens", () => {
			const html = renderToStaticMarkup(<Card variant="surface">Surface</Card>);
			expect(html).toContain('data-card-variant="surface"');
			expect(html).toContain("Surface");
		});
	});

	describe("GlassSurface", () => {
		it("renders regular, clear, and solid variants", () => {
			const variants = ["regular", "clear", "solid"] as const;
			for (const variant of variants) {
				const html = renderToStaticMarkup(
					<GlassSurface variant={variant}>{variant}</GlassSurface>,
				);
				expect(html).toContain('data-glass-surface=""');
				expect(html).toContain(`data-variant="${variant}"`);
			}
		});

		it("forwards data attributes and refs", () => {
			const html = renderToStaticMarkup(
				<GlassSurface data-testid="glass">Glass</GlassSurface>,
			);
			expect(html).toContain('data-testid="glass"');
		});

		it("composes className", () => {
			const html = renderToStaticMarkup(
				<GlassSurface className="extra-class">Glass</GlassSurface>,
			);
			expect(html).toContain("extra-class");
		});

		it("supports composition through asChild without leaking the prop", () => {
			const html = renderToStaticMarkup(
				<GlassSurface asChild>
					<section>Composed glass</section>
				</GlassSurface>,
			);
			expect(html).toContain("<section");
			expect(html).toContain("Composed glass");
			expect(html).not.toContain("asChild");
		});
	});

	describe("FloatingToolbar", () => {
		it("renders with role and aria orientation", () => {
			const html = renderToStaticMarkup(
				<FloatingToolbar aria-label="Main toolbar">
					<button type="button">A</button>
				</FloatingToolbar>,
			);
			expect(html).toContain('role="toolbar"');
			expect(html).toContain('aria-label="Main toolbar"');
			expect(html).toContain('aria-orientation="horizontal"');
		});

		it("supports vertical orientation", () => {
			const html = renderToStaticMarkup(
				<FloatingToolbar aria-label="Vertical toolbar" orientation="vertical">
					<button type="button">A</button>
				</FloatingToolbar>,
			);
			expect(html).toContain('aria-orientation="vertical"');
			expect(html).toContain('data-orientation="vertical"');
		});

		it("forwards data attributes and refs", () => {
			const html = renderToStaticMarkup(
				<FloatingToolbar aria-label="Ref toolbar" data-testid="ref-tb">
					<button type="button">A</button>
				</FloatingToolbar>,
			);
			expect(html).toContain('data-testid="ref-tb"');
		});

		it("supports cyclic arrow and boundary keyboard navigation", () => {
			expect(getToolbarNavigationIndex(0, 3, "ArrowRight", "horizontal")).toBe(1);
			expect(getToolbarNavigationIndex(2, 3, "ArrowRight", "horizontal")).toBe(0);
			expect(getToolbarNavigationIndex(0, 3, "ArrowLeft", "horizontal")).toBe(2);
			expect(getToolbarNavigationIndex(1, 3, "ArrowDown", "vertical")).toBe(2);
			expect(getToolbarNavigationIndex(1, 3, "Home", "vertical")).toBe(0);
			expect(getToolbarNavigationIndex(1, 3, "End", "horizontal")).toBe(2);
			expect(getToolbarNavigationIndex(1, 3, "Escape", "horizontal")).toBeNull();
			expect(getToolbarNavigationIndex(0, 0, "ArrowRight", "horizontal")).toBeNull();
		});
	});
});
