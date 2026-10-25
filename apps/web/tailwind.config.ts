import type { Config } from "tailwindcss";
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px" },
    spacing: {
      0: "0",
      px: "1px",
      1: "4px",
      2: "8px",
      3: "12px",
      4: "16px",
      6: "24px",
      8: "32px",
      12: "48px",
      16: "64px",
      24: "96px",
      tap: "48px",
      "tap-lg": "56px",
    },
    borderRadius: {
      none: "0",
      control: "var(--radius-control)",
      card: "var(--radius-card)",
      pill: "var(--radius-pill)",
    },
    boxShadow: {
      none: "none",
      sheet: "var(--shadow-sheet)",
      raised: "var(--shadow-raised)",
    },
    fontFamily: {
      ui: ["var(--font-ui)", "Noto Sans Devanagari", "Roboto", "system-ui", "sans-serif"],
      display: ["var(--font-display)", "var(--font-ui)", "sans-serif"],
    },
    fontSize: {
      caption: ["0.875rem", { lineHeight: "1.375rem" }],
      small: ["1rem", { lineHeight: "1.625rem" }],
      label: ["1rem", { lineHeight: "1.5rem", fontWeight: "700" }],
      body: ["1.125rem", { lineHeight: "1.875rem" }],
      h4: ["1.125rem", { lineHeight: "1.75rem", fontWeight: "700" }],
      h3: ["1.25rem", { lineHeight: "1.875rem", fontWeight: "700" }],
      h2: ["1.5rem", { lineHeight: "2.125rem", fontWeight: "700" }],
      h1: ["1.875rem", { lineHeight: "2.5rem", fontWeight: "700" }],
      price: ["1.75rem", { lineHeight: "2.125rem", fontWeight: "700" }],
      display: ["2.5rem", { lineHeight: "3rem", fontWeight: "700", letterSpacing: "-0.01em" }],
    },
    fontWeight: {
      normal: "400",
      bold: "700",
    },
    extend: {
      colors: {
        bg: c("bg"),
        surface: { DEFAULT: c("surface"), muted: c("surface-muted") },
        text: { DEFAULT: c("text"), muted: c("text-muted"), subtle: c("text-subtle") },
        border: { control: c("border-control"), subtle: c("border-subtle") },
        chip: c("chip-border"),
        action: {
          DEFAULT: c("action"),
          hover: c("action-hover"),
          pressed: c("action-pressed"),
          on: c("on-action"),
        },
        link: c("link"),
        selected: { DEFAULT: c("selected"), on: c("on-selected"), border: c("selected-border") },
        success: { DEFAULT: c("success"), bg: c("success-bg") },
        warning: { DEFAULT: c("warning"), bg: c("warning-bg") },
        danger: { DEFAULT: c("danger"), bg: c("danger-bg") },
        info: { DEFAULT: c("info"), bg: c("info-bg") },
        overlay: c("overlay"),
      },
      maxWidth: { app: "72rem", read: "38rem" },
    },
  },
} satisfies Config;
