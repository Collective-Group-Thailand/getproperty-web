/**
 * OKLCH → sRGB conversion, relative luminance and WCAG 2.2 contrast ratios.
 *
 * ADR-0003 requires the palette to be authored in OKLCH and validated for contrast in CI.
 * Browsers resolve `oklch()` themselves, so this module exists to answer one question
 * offline: *what will the user actually see?* It therefore mirrors what a browser does —
 * gamut-map by reducing chroma (not by clamping channels, which shifts hue and flatters
 * the ratio) and measure luminance on the linear-light values.
 *
 * No dependencies: `scripts/build-tokens.ts`, `scripts/check-contrast.ts` and the Vitest
 * contrast gate all import it, and the two scripts run under bare `node` (Node 24 strips
 * the types), so it must stay framework-free.
 */

export interface Oklch {
  /** Perceived lightness, 0–1. */
  l: number;
  /** Chroma, 0 – ~0.37. */
  c: number;
  /** Hue angle in degrees. */
  h: number;
  /** Optional alpha, 0–1. Only scrims and hairlines use it; contrast pairs must be opaque. */
  a?: number;
}

export interface Rgb {
  /** Linear-light sRGB, 0–1 (not gamma encoded). */
  r: number;
  g: number;
  b: number;
}

/** The CSS value we emit. Kept as `oklch()` so browsers do their own, better gamut mapping. */
export function oklchCss({ l, c, h, a }: Oklch): string {
  const round = (n: number, digits: number) => Number(n.toFixed(digits));
  const base = `${round(l * 100, 2)}% ${round(c, 4)} ${round(h, 2)}`;
  return a === undefined ? `oklch(${base})` : `oklch(${base} / ${round(a, 3)})`;
}

/** OKLCH → linear-light sRGB. Channels may fall outside 0–1 when the colour is out of gamut. */
export function oklchToLinearSrgb({ l, c, h }: Oklch): Rgb {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3) as [number, number, number];

  const [L, M, S] = lms;
  return {
    r: 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    g: -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    b: -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  };
}

const EPSILON = 0.000005;

function inGamut({ r, g, b }: Rgb): boolean {
  return [r, g, b].every((v) => v >= -EPSILON && v <= 1 + EPSILON);
}

/**
 * Brings an out-of-gamut colour into sRGB the way a browser does: keep lightness and hue,
 * reduce chroma until it fits. Returns the linear-light sRGB of the result.
 */
export function toDisplayableLinearSrgb(colour: Oklch): Rgb {
  const direct = oklchToLinearSrgb(colour);
  if (inGamut(direct)) return clampChannels(direct);

  let lo = 0;
  let hi = colour.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinearSrgb({ ...colour, c: mid }))) lo = mid;
    else hi = mid;
  }
  return clampChannels(oklchToLinearSrgb({ ...colour, c: lo }));
}

function clampChannels({ r, g, b }: Rgb): Rgb {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

function encodeGamma(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

function decodeGamma(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/**
 * `#RRGGBB` → OKLCH. A future brand kit (D-100) arrives as hex; this
 * lets them be authored verbatim, so the value in the token file is the value in the spec.
 */
export function hexToOklch(hex: string): Oklch {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`hexToOklch expects #RRGGBB, got ${hex}`);
  const [r, g, b] = match.slice(1).map((pair) => decodeGamma(parseInt(pair, 16) / 255)) as [number, number, number];

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.hypot(A, B);
  // A grey has no meaningful hue; 0 keeps the emitted CSS stable instead of rounding noise.
  if (c < 1e-4) return { l: L, c: 0, h: 0 };
  return { l: L, c, h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** Hex for tooling that cannot take `oklch()` — Storybook swatch titles, PDF export. */
export function oklchToHex(colour: Oklch): string {
  const { r, g, b } = toDisplayableLinearSrgb(colour);
  const channel = (v: number) =>
    Math.round(encodeGamma(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** WCAG 2.2 relative luminance, measured on linear-light sRGB after gamut mapping. */
export function relativeLuminance(colour: Oklch): number {
  const { r, g, b } = toDisplayableLinearSrgb(colour);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 contrast ratio, 1–21. Order of the arguments does not matter. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}
