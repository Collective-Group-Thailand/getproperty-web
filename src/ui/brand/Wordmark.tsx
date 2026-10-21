import { cn } from "../lib/cn";
import { INK_PATH, WORDMARK_VIEWBOX } from "./geometry";
import { brandA11y, brandHeight, HouseAndChimney, Mark, useGradientId, type BrandGraphicProps } from "./Mark";

export interface WordmarkProps extends BrandGraphicProps {
  /** The mark only — the collapsed sidebar, a phone's top bar. */
  compact?: boolean;
}

const [, , VIEW_WIDTH, VIEW_HEIGHT] = WORDMARK_VIEWBOX.split(" ").map(Number) as [number, number, number, number];

/**
 * The getproperty logo (D-001: lower case), drawn from the founder's artwork (docs/brand): "getproper" in
 * navy, the house "ty" in blue, the chimney's sky → azure gradient. The lettering is part of the drawing —
 * never set "getproperty" in a font next to it. Sized by height; named "getproperty" for assistive
 * technology unless `decorative`. Server-renderable (see `Mark`).
 */
export function Wordmark({
  size = "md",
  tone = "auto",
  compact = false,
  decorative = false,
  className,
}: WordmarkProps) {
  const gradientId = useGradientId();
  if (compact) return <Mark size={size} tone={tone} decorative={decorative} className={className} />;
  const height = brandHeight(size);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={WORDMARK_VIEWBOX}
      width={Math.round((height * VIEW_WIDTH) / VIEW_HEIGHT)}
      height={height}
      className={cn("shrink-0", className)}
      data-brand="wordmark"
      {...brandA11y(decorative)}
    >
      <path className={tone === "onDark" ? "fill-white" : "fill-logo-ink"} fillRule="evenodd" d={INK_PATH} />
      <HouseAndChimney tone={tone} gradientId={gradientId} />
    </svg>
  );
}
