/**
 * Tier 1 — the non-colour primitives: space, radius, elevation, motion, type.
 *
 * Values come from design-system.md §2: 4-px spacing, radius 4/8/12/16/full, elevation 0–3,
 * motion 120/200/320 ms honouring `prefers-reduced-motion`, type scale 12/14/16/18/20/24/30/36 with
 * Thai body line-height ≥ 1.6.
 */

/** 4-px base. Tailwind's own `--spacing` multiplier, so `p-4` stays 16 px. */
export const SPACING_BASE = "0.25rem";

export const RADIUS = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  /** Circles and pills — an avatar, a status dot, a resident's pay button. */
  full: "9999px",
  /** Buttons, inputs, selects, chips, segmented controls: 8 px. */
  control: "0.5rem",
  /** Cards, panels, list rows, dialogs: 12 px. */
  card: "0.75rem",
  /** A resident's full-bleed hero card and the bottom sheet: 16 px. */
  panel: "1rem",
  /** Photographs and photo bands on the public marketing pages: 20 px. */
  photo: "1.25rem",
} as const;

/** Content widths: the owner console at 1280, a resident page at a phone's 480, a reading form at 640. */
export const CONTAINER = {
  phone: "30rem",
  form: "40rem",
  console: "80rem",
} as const;

/**
 * Elevation 0–3, tinted with the warm ink rather than black so a shadow never muddies the paper.
 */
export const SHADOW = {
  none: "none",
  /** 1 — a card resting on the page. */
  card: "0 1px 2px rgb(40 35 28 / 0.06), 0 1px 1px rgb(40 35 28 / 0.04)",
  /** 2 — a card lifted on hover, a popover. */
  raised: "0 4px 12px rgb(40 35 28 / 0.1)",
  /** 3 — dialogs, sheets, menus. */
  overlay: "0 12px 32px rgb(40 35 28 / 0.14)",
} as const;

/** 120 / 200 / 320 ms (design-system.md §2). */
export const DURATION = {
  fast: "120ms",
  base: "200ms",
  slow: "320ms",
} as const;

export const EASING = {
  /** Ease-out: hovers and anything entering. */
  standard: "cubic-bezier(0, 0, 0.2, 1)",
  emphasised: "cubic-bezier(0.3, 0, 0, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/**
 * Type scale 12/14/16/18/20/24/30/36 (design-system.md §2). Fixed sizes: a bill is read on one
 * phone, and a tabular figure that changed size between breakpoints would never line up.
 * The staff zone raises `--text-base` to 18 px in `src/ui/styles/zones.css`.
 */
/*
 * TYPE SCALE — the one place every text size lives (founder 2026-10-24: one typeface for the whole system and sizes
 * that are easy to change, as in getpack partner). Change a value here and run `pnpm tokens`: every `text-*` utility
 * in every screen follows. Components never set a size of their own (no `text-[…]`; src/ui/design-language.test.ts).
 *
 * Three scales, picked by where the text is (generated into src/ui/generated/tokens.css):
 *   FONT_SIZE          the default and the public marketing pages (`data-type-scale="marketing"`) — fluid between a
 *                      360-px phone and a 1280-px desktop, so a Thai headline never needs per-breakpoint tuning
 *   CONSOLE_FONT_SIZE  the owner console and the platform admin (`data-zone` owner/admin) — fixed, dense, the
 *                      getpack partner/admin scale: 12 · 13 · 15 · 17 · 20 · 24
 *   staff              src/ui/styles/zones.css — 18-px base for gloved thumbs (D-154 §5)
 *
 *   step     marketing            console   used for
 *   2xs      11                   11        chart axis labels, the count badge
 *   xs       12                   12        badges, chips, tiny meta
 *   sm       14                   13        hints, captions, table headers
 *   base     16                   15        body, table cells, buttons
 *   lg       18 → 19              17        lead text, section titles, stat values
 *   xl       20 → 22              20        card titles; the console page title
 *   2xl      24 → 28              24        sub-headlines
 *   3xl      30 → 38              24        section titles (marketing)
 *   4xl      36 → 48              30        section openers; the console's money hero
 *   display  40 → 64              30        the one h1 of a marketing page
 */
export const FONT_SIZE = {
  "2xs": "0.6875rem",
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "clamp(1.125rem, 1.1rem + 0.13vw, 1.1875rem)",
  xl: "clamp(1.25rem, 1.19rem + 0.27vw, 1.375rem)",
  "2xl": "clamp(1.5rem, 1.39rem + 0.54vw, 1.75rem)",
  "3xl": "clamp(1.875rem, 1.6rem + 1.2vw, 2.375rem)",
  "4xl": "clamp(2.25rem, 1.87rem + 1.7vw, 3rem)",
  display: "clamp(2.5rem, 1.6rem + 3.6vw, 4rem)",
} as const;

/** Line height per step of FONT_SIZE (unitless). Thai body ≥ 1.6; headlines tighter but never below 1.2. */
export const FONT_LINE_HEIGHT = {
  "2xs": "1.4",
  xs: "1.5",
  sm: "1.6",
  base: "1.6",
  lg: "1.6",
  xl: "1.5",
  "2xl": "1.4",
  "3xl": "1.3",
  "4xl": "1.25",
  display: "1.2",
} as const satisfies Record<keyof typeof FONT_SIZE, string>;

/** The console scale (owner console, platform admin): fixed sizes and line heights — getpack partner/admin. */
export const CONSOLE_FONT_SIZE = {
  "2xs": "0.6875rem",
  xs: "0.75rem",
  sm: "0.8125rem",
  base: "0.9375rem",
  lg: "1.0625rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.5rem",
  "4xl": "1.875rem",
  display: "1.875rem",
} as const satisfies Record<keyof typeof FONT_SIZE, string>;

export const CONSOLE_LINE_HEIGHT = {
  "2xs": "1rem",
  xs: "1.125rem",
  sm: "1.25rem",
  base: "1.5rem",
  lg: "1.625rem",
  xl: "1.75rem",
  "2xl": "2rem",
  "3xl": "2rem",
  "4xl": "2.375rem",
  display: "2.375rem",
} as const satisfies Record<keyof typeof FONT_SIZE, string>;

/** Thai needs room for upper vowels and tone marks: body ≥ 1.6, headings no tighter than 1.25. */
export const LINE_HEIGHT = {
  tight: "1.25",
  snug: "1.4",
  normal: "1.6",
  relaxed: "1.75",
} as const;

export const FONT_WEIGHT = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Font stacks (ADR-0001). The `--font-gp-*` variables are produced by `next/font/local`
 * (`src/ui/fonts`); Latin comes first so the Latin companion wins for ASCII and Thai codepoints
 * fall through to the Thai subset.
 */
export const FONT_FAMILY = {
  /**
   * ONE typeface for the whole system — Anuphan, Thai and Latin (founder 2026-10-24, as getpack: one family so the
   * Thai and Latin x-heights match; the separate Thai UI family is no longer loaded). Headlines are Anuphan too, heavier and
   * tighter (base.css). Numbers keep the mono face below for tabular bill and meter figures.
   */
  sans: "var(--font-gp-display-latin), var(--font-gp-display-thai), ui-sans-serif, system-ui, sans-serif",
  display: "var(--font-gp-display-latin), var(--font-gp-display-thai), ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-gp-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Stacking order. Overlays come from Radix portals, so only a few levels are needed. */
export const Z_INDEX = {
  base: "0",
  sticky: "30",
  overlay: "40",
  modal: "50",
  toast: "60",
} as const;
