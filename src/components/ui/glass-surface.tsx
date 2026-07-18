import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const glassSurfaceVariants = cva(
	[
		"relative isolate overflow-hidden",
		"rounded-surface border transition-[background-color,border-color,box-shadow,filter,transform] duration-normal ease-aureo-default",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
	],
	{
		variants: {
			variant: {
				regular: "glass text-surface-foreground shadow-aureo-2",
				clear: "glass-clear text-surface-foreground shadow-aureo-1",
				solid: "bg-surface-panel text-surface-foreground shadow-aureo-2 border-hairline",
			},
			padding: {
				none: "",
				default: "p-4",
				comfortable: "p-6",
				compact: "p-3",
			},
		},
		defaultVariants: {
			variant: "regular",
			padding: "default",
		},
	},
);

export interface GlassSurfaceProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof glassSurfaceVariants> {
	/** Optional slot to render the surface itself (e.g. as a popover container). */
	asChild?: boolean;
}

const GlassSurface = React.forwardRef<HTMLDivElement, GlassSurfaceProps>(
	({ className, variant, padding, asChild = false, children, ...props }, ref) => {
		const Comp = asChild ? Slot : "div";
		return (
			<Comp
				ref={ref}
				data-variant={variant ?? "regular"}
				data-glass-surface=""
				className={cn(glassSurfaceVariants({ variant, padding, className }))}
				{...props}
			>
				{children}
			</Comp>
		);
	},
);
GlassSurface.displayName = "GlassSurface";

export { GlassSurface, glassSurfaceVariants };
