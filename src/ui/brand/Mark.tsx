import { useId } from "react";

import { cn } from "../lib/cn";
import { BRAND_NAME } from "./config";
import { CHIMNEY_GRADIENT, CHIMNEY_PATH, HOUSE_PATH, MARK_VIEWBOX } from "./geometry";

/** Logo heights in CSS pixels. The width follows the artwork (the mark is square, the full logo ≈ 4.7 : 1). */
export const BRAND_HEIGHT = { sm: 28, md: 36, lg: 56 } as const;
export type BrandSize = keyof typeof BRAND_HEIGHT;

/**
 * `auto` follows the theme through the `logo-*` tokens: the founder's colours on light and high contrast,
 * the founder's one-colour white version on dark. `onDark` is that white version whatever the theme —
 * for a brand-blue or photographic background.
 */
export type BrandTone = "auto" | "onDark";

export interface BrandGraphicProps {
  /** Height: `sm` 28 px · `md` 36 px · `lg` 56 px, or a number of CSS pixels. */
  size?: BrandSize | number;
  tone?: BrandTone;
  /**
   * Hidden from assistive technology — when visible text or the enclosing control already names the
   * brand. Otherwise the graphic is an image named "getproperty".
   */
  decorative?: boolean;
  className?: string;
}

export const brandHeight = (size: BrandSize | number) => (typeof size === "number" ? size : BRAND_HEIGHT[size]);

/** `useId` output (`«r1»`, `_r_1_`) made safe for `url(#…)`: letters, digits, `_` and `-` only. */
export function useGradientId(): string {
  return `gp-chimney-${useId().replace(/[^\w-]/g, "")}`;
}

/** Accessible name or hidden — the same rule for the mark and the full logo. */
export function brandA11y(decorative: boolean) {
  return decorative
    ? ({ "aria-hidden": true, focusable: "false" } as const)
    : ({ role: "img", "aria-label": BRAND_NAME, focusable: "false" } as const);
}

/**
 * The house "ty" and its chimney, shared by `Mark` and `Wordmark`. The chimney's vertical gradient is
 * part of the logo; its id is unique per instance, so two logos on a page never share (or lose) one.
 */
export function HouseAndChimney({ tone, gradientId }: { tone: BrandTone; gradientId: string }) {
  const white = tone === "onDark";
  return (
    <>
      {white ? null : (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" {...CHIMNEY_GRADIENT}>
            <stop offset="0" className="[stop-color:var(--color-logo-chimney-top)]" />
            <stop offset="1" className="[stop-color:var(--color-logo-chimney-bottom)]" />
          </linearGradient>
        </defs>
      )}
      <path className={white ? "fill-white" : "fill-logo-house"} fillRule="evenodd" d={HOUSE_PATH} />
      <path
        className={white ? "fill-white" : undefined}
        fill={white ? undefined : `url(#${gradientId})`}
        fillRule="evenodd"
        d={CHIMNEY_PATH}
      />
    </>
  );
}

/**
 * The getproperty mark — the house "ty" with its chimney, from the founder's logo (docs/brand). For the
 * collapsed sidebar, a phone's top bar, anywhere the full logo does not fit. Renders on the server: it
 * adds markup, never client JavaScript, unless a client component imports it — pass it to client
 * frames as a prop instead.
 */
export function Mark({ size = "md", tone = "auto", decorative = false, className }: BrandGraphicProps) {
  const gradientId = useGradientId();
  const height = brandHeight(size);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MARK_VIEWBOX}
      width={height}
      height={height}
      className={cn("shrink-0", className)}
      data-brand="mark"
      {...brandA11y(decorative)}
    >
      <HouseAndChimney tone={tone} gradientId={gradientId} />
    </svg>
  );
}
