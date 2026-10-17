import { createElement } from "react";

import { cn } from "../lib/cn";
import type { IconGlyph } from "./glyph";

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref" | "children"> {
  /** A glyph from `@/ui/icons/glyphs/<name>` (`IconCheck`, `IconMeter`…). */
  icon: IconGlyph;
  /**
   * Accessible name. Omit it for decoration that sits next to a text label — the icon is
   * then `aria-hidden`, which is what you want in a button that already says "Save".
   * Give it whenever the icon is the only thing carrying the meaning.
   */
  label?: string;
  /** Pixel size; defaults to 1em so an icon tracks the text beside it. */
  size?: number | string;
}

/**
 * The only way to render an icon (ADR-0002, D-179). Icons never come straight from `lucide-react`
 * in app code: the curated set (`./curated.ts`) keeps it small, and each glyph is imported on its
 * own so a page ships only the icons it draws. Works in server and client components alike.
 *
 * Never colour alone — design-system.md §2 requires icon *and* text for status, so this
 * inherits `currentColor` and has no colour prop.
 */
export function Icon({ icon, label, size = "1em", className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      // Lucide draws on a 24-px grid; a fixed absolute stroke keeps weights even across sizes.
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable={false}
      data-icon={icon.name}
      {...props}
    >
      {icon.node.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs }))}
    </svg>
  );
}
