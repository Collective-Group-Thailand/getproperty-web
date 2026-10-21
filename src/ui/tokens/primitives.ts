/**
 * Tier 1 — primitives: the raw palette and nothing else.
 *
 * Authored in OKLCH (ADR-0003) so every palette keeps one perceived lightness ramp across hues:
 * `red-700` and `brand-700` are equally dark, which is what makes the semantic tier swappable and the
 * contrast gate predictable. Never reference a primitive from a component — go through
 * `semantic.ts`, or the gate cannot see what you did.
 *
 * The brand hues come from the founder's logo (docs/brand, 2026-10-21; docs/ui/brand.md): the
 * lettering's navy and the house's blue drive actions, links and the focus ring, the chimney's sky is
 * the dark-theme accent. Warm neutrals for the page, amber for "needs attention". No getpack colour is
 * in here (D-003). The logo's hex values are pasted verbatim through `hexToOklch`.
 */

import { hexToOklch, type Oklch } from "./color";

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Step = (typeof STEPS)[number];

/** Shared lightness ramp. Every palette uses it, so steps are comparable across hues. */
const LIGHTNESS: Record<Step, number> = {
  50: 0.985,
  100: 0.962,
  200: 0.918,
  300: 0.855,
  400: 0.762,
  500: 0.658,
  600: 0.568,
  700: 0.49,
  800: 0.42,
  900: 0.35,
  950: 0.262,
};

/** Chroma as a fraction of the palette's peak: saturated in the middle, calm at both ends. */
const CHROMA_CURVE: Record<Step, number> = {
  50: 0.06,
  100: 0.14,
  200: 0.28,
  300: 0.48,
  400: 0.74,
  500: 0.94,
  600: 1,
  700: 0.94,
  800: 0.82,
  900: 0.68,
  950: 0.5,
};

export type Palette = Record<Step, Oklch>;

function palette(hue: number, peakChroma: number): Palette {
  return Object.fromEntries(
    STEPS.map((step) => [step, { l: LIGHTNESS[step], c: peakChroma * CHROMA_CURVE[step], h: hue }]),
  ) as Palette;
}

export const WHITE: Oklch = { l: 1, c: 0, h: 0 };
export const BLACK: Oklch = { l: 0, c: 0, h: 0 };

/** Transparent black/white for scrims and hairlines, where a solid colour would hide content. */
export const alpha = (colour: Oklch, a: number): Oklch => ({ ...colour, a });

/**
 * The logo's own colours, verbatim from the founder's artwork (docs/brand/getproperty-logo.svg). The
 * semantic tier uses them where they pass the contrast gate as they are — `blue` is the light theme's
 * `primary` (8.1:1 on white), `navy` its hover and the high-contrast `primary`, `sky` the dark theme's
 * `primary` — and the `brand` ramp below for the quiet steps around them. The logo itself reads them
 * through the `logo-*` semantic keys.
 */
export const BRAND = {
  /** "getproper" — the lettering. */
  navy: hexToOklch("#21365B"),
  /** The house "ty". */
  blue: hexToOklch("#1A4BA3"),
  /** The chimney gradient, top → bottom. */
  sky: hexToOklch("#62AEF9"),
  azure: hexToOklch("#2E69F5"),
} as const satisfies Record<string, Oklch>;

export const PALETTES = {
  /** Warm grey (a hint of the paper's hue) — the chrome of every zone. */
  neutral: palette(75, 0.012),
  /** The brand ramp, on the hue of the logo's house blue (261). Quiet fills and hover steps around `BRAND`. */
  brand: palette(261, 0.16),
  /** Success — paid, synced, healthy. Far from the brand blue on the wheel, so the two never merge. */
  green: palette(145, 0.15),
  /** "Needs attention" — due soon, estimated reading, pending slip (D-100: never red for money merely due). */
  amber: palette(72, 0.16),
  /** Danger — overdue, refused by compliance, device offline. */
  red: palette(27, 0.19),
  /**
   * Info — neutral facts, system notices. Cerulean (hue 228), turned away from the brand's royal blue
   * (261) so an info badge never reads as a primary one.
   */
  blue: palette(228, 0.14),
} as const satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

/**
 * The warm paper the owner console sits on, and its dark counterpart. Hand-set rather than ramp
 * steps: a page background wants less chroma than a palette step and a touch more warmth.
 */
export const PAPER = {
  light: {
    page: { l: 0.978, c: 0.006, h: 80 },
    band: { l: 0.955, c: 0.008, h: 80 },
    surface: WHITE,
    border: { l: 0.9, c: 0.008, h: 80 },
    ink: { l: 0.22, c: 0.012, h: 75 },
    "ink-muted": { l: 0.44, c: 0.012, h: 75 },
    "ink-subtle": { l: 0.58, c: 0.012, h: 75 },
  },
  dark: {
    page: { l: 0.17, c: 0.008, h: 75 },
    band: { l: 0.205, c: 0.009, h: 75 },
    surface: { l: 0.235, c: 0.01, h: 75 },
    border: { l: 0.32, c: 0.01, h: 75 },
    ink: { l: 0.95, c: 0.006, h: 80 },
    "ink-muted": { l: 0.78, c: 0.01, h: 80 },
    "ink-subtle": { l: 0.64, c: 0.01, h: 80 },
  },
} as const satisfies Record<"light" | "dark", Record<string, Oklch>>;
