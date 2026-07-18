/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
				shimmer: {
					"100%": {
						transform: "translateX(100%)",
					},
				},
				"text-shimmer": {
					"0%, 100%": {
						"background-size": "200% 200%",
						"background-position": "left center",
					},
					"50%": {
						"background-size": "200% 200%",
						"background-position": "right center",
					},
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				shimmer: "shimmer 2s infinite",
				"text-shimmer": "text-shimmer 2.5s ease-out infinite",
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
				"control-sm": "var(--radius-control-sm)",
				control: "var(--radius-control)",
				"surface-lg": "var(--radius-surface-lg)",
				surface: "var(--radius-surface)",
			},
			colors: {
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				chart: {
					1: "hsl(var(--chart-1))",
					2: "hsl(var(--chart-2))",
					3: "hsl(var(--chart-3))",
					4: "hsl(var(--chart-4))",
					5: "hsl(var(--chart-5))",
				},
				"editor-bg": "hsl(var(--editor-bg))",
				"editor-header": "hsl(var(--editor-header))",
				"editor-panel": "hsl(var(--editor-panel))",
				"editor-surface": "hsl(var(--editor-surface))",
				"editor-surface-alt": "hsl(var(--editor-surface-alt))",
				"editor-dialog": "hsl(var(--editor-dialog))",
				"editor-dialog-alt": "hsl(var(--editor-dialog-alt))",
				"editor-timeline": "hsl(var(--editor-timeline))",
				"editor-row": "hsl(var(--editor-row))",
				"editor-subrow": "hsl(var(--editor-subrow))",
				"surface-content": "hsl(var(--surface-content))",
				"surface-shell": "hsl(var(--surface-shell))",
				"surface-panel": "hsl(var(--surface-panel))",
				"surface-elevated": "hsl(var(--surface-elevated))",
				"surface-floating": "hsl(var(--surface-floating))",
				"surface-glass": {
					regular: "hsl(var(--surface-glass-regular))",
					clear: "hsl(var(--surface-glass-clear))",
					solid: "hsl(var(--surface-glass-solid))",
				},
				"surface-foreground": {
					DEFAULT: "hsl(var(--surface-foreground))",
					muted: "hsl(var(--surface-foreground-muted))",
					inverse: "hsl(var(--surface-foreground-inverse))",
				},
				hairline: {
					DEFAULT: "hsl(var(--hairline))",
					strong: "hsl(var(--hairline-strong))",
				},
				highlight: {
					DEFAULT: "hsl(var(--highlight))",
					strong: "hsl(var(--highlight-strong))",
				},
			},
			boxShadow: {
				"aureo-1": "var(--shadow-1)",
				"aureo-2": "var(--shadow-2)",
				"aureo-3": "var(--shadow-3)",
			},
			transitionDuration: {
				instant: "var(--motion-duration-instant)",
				fast: "var(--motion-duration-fast)",
				normal: "var(--motion-duration-normal)",
				slow: "var(--motion-duration-slow)",
			},
			transitionTimingFunction: {
				"aureo-default": "var(--motion-easing-default)",
				"aureo-emphasis": "var(--motion-easing-emphasis)",
				"aureo-bounce": "var(--motion-easing-bounce)",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
