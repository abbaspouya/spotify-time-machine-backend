import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui"],
        body: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        panel: "0 28px 80px -36px rgba(0, 0, 0, 0.72)",
        glow: "0 24px 70px -28px rgba(29, 185, 84, 0.38)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "track-page-in-right": {
          "0%": { opacity: "0", transform: "translateX(26px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "track-page-in-left": {
          "0%": { opacity: "0", transform: "translateX(-26px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        pulseborder: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(29, 185, 84, 0.12)" },
          "50%": { boxShadow: "0 0 0 10px rgba(29, 185, 84, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s ease-out both",
        "track-page-in-right": "track-page-in-right 0.34s cubic-bezier(0.22, 1, 0.36, 1) both",
        "track-page-in-left": "track-page-in-left 0.34s cubic-bezier(0.22, 1, 0.36, 1) both",
        pulseborder: "pulseborder 2.3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

export default config
