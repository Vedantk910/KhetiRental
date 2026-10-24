import type { Config } from "tailwindcss";
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

/* LEGACY until M7: scale steps and colours the pre-Mitti pages (marketplace, pricing, escrow,
   H3 sandbox, dossiers, architecture) still use. New code must not use anything in these blocks. */
const legacySpacing = {
  0.5: "0.125rem",
  1.5: "0.375rem",
  2.5: "0.625rem",
  3.5: "0.875rem",
  5: "1.25rem",
  7: "1.75rem",
  10: "2.5rem",
  14: "3.5rem",
  28: "7rem",
  48: "12rem",
  56: "14rem",
  64: "16rem",
};
const legacyFontSize = {
  xs: ["0.75rem", { lineHeight: "1rem" }],
  sm: ["0.875rem", { lineHeight: "1.25rem" }],
  base: ["1rem", { lineHeight: "1.5rem" }],
  lg: ["1.125rem", { lineHeight: "1.75rem" }],
  xl: ["1.25rem", { lineHeight: "1.75rem" }],
  "2xl": ["1.5rem", { lineHeight: "2rem" }],
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
  "5xl": ["3rem", { lineHeight: "1" }],
} satisfies Record<string, [string, { lineHeight: string }]>;
const legacyColors = {
  primary: { DEFAULT: "var(--primary)", fg: "var(--primary-fg)" },
  soil: "var(--soil)",
  fg: "var(--fg)",
  muted: "var(--muted)",
  line: "var(--line)",
};
/* end LEGACY */

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
      ...legacySpacing,
    },
    borderRadius: {
      none: "0",
      control: "var(--radius-control)",
      card: "var(--radius-card)",
      pill: "var(--radius-pill)",
      // LEGACY until M7
      sm: "0.125rem",
      DEFAULT: "0.25rem",
      md: "0.375rem",
      lg: "0.5rem",
      xl: "0.75rem",
      "2xl": "1rem",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      sheet: "var(--shadow-sheet)",
      raised: "var(--shadow-raised)",
      // LEGACY until M7
      xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    },
    fontFamily: {
      ui: ["var(--font-ui)", "Noto Sans Devanagari", "Roboto", "system-ui", "sans-serif"],
      display: ["var(--font-display)", "var(--font-ui)", "sans-serif"],
      // LEGACY until M7
      sans: ["var(--font-ui)", "system-ui", "sans-serif"],
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
      ...legacyFontSize,
    },
    fontWeight: {
      normal: "400",
      bold: "700",
      // LEGACY until M7
      medium: "500",
      semibold: "600",
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
        ...legacyColors,
      },
      maxWidth: { app: "72rem", read: "38rem" },
    },
  },
} satisfies Config;
