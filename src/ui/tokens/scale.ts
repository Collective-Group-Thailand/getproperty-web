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
export const FONT_SIZE = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
} as const;

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
  sans: "var(--font-gp-sans-latin), var(--font-gp-sans-thai), ui-sans-serif, system-ui, sans-serif",
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
