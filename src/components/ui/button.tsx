import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	[
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
		"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
		"disabled:pointer-events-none disabled:opacity-50",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0",
		"transition-[color,background-color,border-color,box-shadow,transform] duration-normal ease-aureo-default",
	],
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
				destructive:
					"bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
				outline:
					"border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
				secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
				polished:
					"bg-surface-elevated text-surface-foreground border border-hairline shadow-aureo-1 hover:-translate-y-px hover:bg-surface-floating hover:shadow-aureo-2 active:translate-y-0 active:scale-[0.98]",
				quiet: "bg-transparent text-surface-foreground hover:bg-surface-panel/80 hover:text-surface-foreground active:scale-[0.97]",
				glass: "glass text-surface-foreground hover:bg-surface-foreground/[0.06] hover:shadow-aureo-2 active:scale-[0.97]",
				toolbar:
					"rounded-control-sm bg-transparent text-surface-foreground hover:bg-surface-foreground/10 active:scale-[0.96] active:bg-surface-foreground/15",
			},
			size: {
				default: "h-9 px-4 py-2",
				xs: "h-7 rounded-control-sm px-2 text-xs gap-1.5",
				sm: "h-8 rounded-md px-3 text-xs",
				md: "h-9 px-4 py-2 text-sm",
				lg: "h-10 rounded-md px-8",
				xl: "h-11 rounded-control px-6 text-base",
				icon: "h-9 w-9",
				"icon-sm": "h-7 w-7",
				"icon-lg": "h-10 w-10",
			},
			iconSize: {
				default: "[&_svg]:size-4",
				sm: "[&_svg]:size-3.5",
				lg: "[&_svg]:size-5",
				xl: "[&_svg]:size-6",
			},
		},
		compoundVariants: [
			{
				variant: "toolbar",
				size: "default",
				className: "h-8 px-2.5",
			},
		],
		defaultVariants: {
			variant: "default",
			size: "default",
			iconSize: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	/** Whether to render the button as a child component (useful for composition) */
	asChild?: boolean;
	/** Size of the icon inside the button */
	iconSize?: "default" | "sm" | "lg" | "xl";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, iconSize, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, iconSize, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
