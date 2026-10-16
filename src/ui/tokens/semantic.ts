/**
 * Tier 2 — semantic: what a colour *means*, resolved per theme.
 *
 * Components only ever name these. Adding a key means defining it in all three themes (TypeScript
 * enforces that) and, if it is a text or UI pair, declaring it in `scripts/check-contrast.ts` — the
 * gate decides whether the value is allowed (ADR-0003).
 *
 * Key names are chosen to read well as Tailwind utilities, the way design-system.md §2 writes
 * them: `bg-primary`, `text-muted`, `border-border`, `ring-focus-ring`. The spec's `text` /
 * `text-muted` is spelled `fg` / `muted` here so `--color-*` does not generate `text-text-muted`.
 */

import type { Oklch } from "./color";
import { alpha, BLACK, PALETTES as P, PAPER, WHITE } from "./primitives";

interface BaseSlots {
  /** Page background, and the quieter band that separates sections. */
  bg: Oklch;
  "bg-subtle": Oklch;
  /** Cards, panels, menus — anything sitting on top of `bg`. */
  surface: Oklch;
  "surface-subtle": Oklch;
  "surface-raised": Oklch;
  /** Scrim behind dialogs and sheets. */
  overlay: Oklch;
  border: Oklch;
  "border-strong": Oklch;
  /** Body text; secondary text (still 4.5:1); de-emphasised UI text — placeholders, disabled (3:1). */
  fg: Oklch;
  muted: Oklch;
  subtle: Oklch;
  /** Text on a solid dark/brand fill. */
  "fg-inverse": Oklch;
  "primary-hover": Oklch;
  /** Hover fill for the destructive button. Dimming with opacity would dim its label too. */
  "danger-hover": Oklch;
  "focus-ring": Oklch;
}

/**
 * `warning` is amber: "needs attention" — due soon, estimated reading, a slip waiting (D-100). It is
 * never used for money that is merely due. `danger` is red: overdue, refused, offline.
 */
const TONE_NAMES = ["primary", "success", "warning", "danger", "info", "neutral"] as const;
export type ToneName = (typeof TONE_NAMES)[number];

/** One tone's four slots: the solid fill with its text, and the quiet variant badges use. */
interface Tone {
  base: Oklch;
  fg: Oklch;
  subtle: Oklch;
  subtleFg: Oklch;
}

type ToneKey = ToneName | `${ToneName}-fg` | `${ToneName}-subtle` | `${ToneName}-subtle-fg`;

/** Every semantic key, e.g. `bg-subtle`, `primary-fg`, `danger-subtle`. */
export type SemanticKey = keyof BaseSlots | ToneKey;
export type SemanticTheme = Record<SemanticKey, Oklch>;

function build(base: BaseSlots, tones: Record<ToneName, Tone>): SemanticTheme {
  const out = { ...base } as SemanticTheme;
  for (const name of TONE_NAMES) {
    out[name] = tones[name].base;
    out[`${name}-fg`] = tones[name].fg;
    out[`${name}-subtle`] = tones[name].subtle;
    out[`${name}-subtle-fg`] = tones[name].subtleFg;
  }
  return out;
}

const LP = PAPER.light;
const DP = PAPER.dark;

/**
 * Light — the owner, staff and admin default (00-master-plan.md §2). Warm paper page, white cards,
 * warm ink, one teal for actions.
 */
const light = build(
  {
    bg: LP.page,
    "bg-subtle": LP.band,
    surface: LP.surface,
    "surface-subtle": LP.page,
    "surface-raised": LP.surface,
    overlay: alpha(P.neutral[950], 0.55),
    border: LP.border,
    "border-strong": P.neutral[600],
    fg: LP.ink,
    muted: LP["ink-muted"],
    subtle: LP["ink-subtle"],
    "fg-inverse": WHITE,
    "primary-hover": P.teal[800],
    "danger-hover": P.red[800],
    "focus-ring": P.teal[700],
  },
  {
    primary: { base: P.teal[700], fg: WHITE, subtle: P.teal[50], subtleFg: P.teal[900] },
    success: { base: P.green[800], fg: WHITE, subtle: P.green[50], subtleFg: P.green[900] },
    // A solid amber fill is rare (the quiet badge carries the amber look); when it is used — a
    // "needs attention" icon or dot on a card — it must read at 3:1, which takes the 800 step.
    warning: { base: P.amber[800], fg: WHITE, subtle: P.amber[100], subtleFg: P.amber[900] },
    danger: { base: P.red[700], fg: WHITE, subtle: P.red[50], subtleFg: P.red[900] },
    info: { base: P.blue[700], fg: WHITE, subtle: P.blue[50], subtleFg: P.blue[900] },
    neutral: { base: P.neutral[700], fg: WHITE, subtle: P.neutral[100], subtleFg: P.neutral[900] },
  },
);

/** Dark — the tenant zone follows the OS; every zone offers it through `gp_theme`. */
const dark = build(
  {
    bg: DP.page,
    "bg-subtle": DP.band,
    surface: DP.surface,
    "surface-subtle": DP.band,
    // Menus and popovers need to sit one step above a dark card.
    "surface-raised": { ...DP.surface, l: DP.surface.l + 0.04 },
    overlay: alpha(BLACK, 0.65),
    border: DP.border,
    "border-strong": P.neutral[500],
    fg: DP.ink,
    muted: DP["ink-muted"],
    subtle: DP["ink-subtle"],
    "fg-inverse": DP.page,
    // Hovering in dark goes one step *lighter*, which keeps the dark label pair at AA.
    "primary-hover": P.teal[300],
    "danger-hover": P.red[300],
    "focus-ring": P.teal[400],
  },
  {
    primary: { base: P.teal[400], fg: DP.page, subtle: P.teal[950], subtleFg: P.teal[300] },
    success: { base: P.green[400], fg: DP.page, subtle: P.green[950], subtleFg: P.green[300] },
    warning: { base: P.amber[400], fg: DP.page, subtle: P.amber[950], subtleFg: P.amber[300] },
    danger: { base: P.red[400], fg: DP.page, subtle: P.red[950], subtleFg: P.red[300] },
    info: { base: P.blue[400], fg: DP.page, subtle: P.blue[950], subtleFg: P.blue[300] },
    neutral: { base: P.neutral[400], fg: DP.page, subtle: P.neutral[800], subtleFg: P.neutral[200] },
  },
);

/**
 * High contrast — the staff PWA's sunlight option (design-system.md §5): black on white, heavy
 * borders, every tone at its darkest step so a status reads on a 6" phone outdoors.
 */
const hc = build(
  {
    bg: WHITE,
    "bg-subtle": WHITE,
    surface: WHITE,
    "surface-subtle": LP.page,
    "surface-raised": WHITE,
    overlay: alpha(BLACK, 0.7),
    border: P.neutral[700],
    "border-strong": BLACK,
    fg: BLACK,
    muted: P.neutral[900],
    subtle: P.neutral[800],
    "fg-inverse": WHITE,
    "primary-hover": P.teal[950],
    "danger-hover": P.red[950],
    "focus-ring": BLACK,
  },
  {
    primary: { base: P.teal[900], fg: WHITE, subtle: P.teal[50], subtleFg: P.teal[950] },
    success: { base: P.green[900], fg: WHITE, subtle: P.green[50], subtleFg: P.green[950] },
    warning: { base: P.amber[900], fg: WHITE, subtle: P.amber[50], subtleFg: P.amber[950] },
    danger: { base: P.red[900], fg: WHITE, subtle: P.red[50], subtleFg: P.red[950] },
    info: { base: P.blue[900], fg: WHITE, subtle: P.blue[50], subtleFg: P.blue[950] },
    neutral: { base: BLACK, fg: WHITE, subtle: P.neutral[100], subtleFg: BLACK },
  },
);

export const THEMES = { light, dark, hc } as const;
export type ThemeName = keyof typeof THEMES;
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];
export const SEMANTIC_KEYS = Object.keys(light) as SemanticKey[];
