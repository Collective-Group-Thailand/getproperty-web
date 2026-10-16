import { cn } from "../lib/cn";
import { BRAND_NAME } from "./config";
import { Mark } from "./Mark";

export interface WordmarkProps {
  /** Mark height in CSS pixels; the type follows. */
  size?: "sm" | "md" | "lg";
  /** Mark only — the collapsed sidebar, the favicon-sized header on a phone. */
  compact?: boolean;
  className?: string;
}

const SIZE = {
  sm: { mark: 22, text: "text-base" },
  md: { mark: 28, text: "text-xl" },
  lg: { mark: 40, text: "text-3xl" },
} as const;

/**
 * The lower-case wordmark (D-001): mark + "getproperty" set in the display face. The accessible name
 * is the brand name; the mark itself is decorative.
 */
export function Wordmark({ size = "md", compact = false, className }: WordmarkProps) {
  const s = SIZE[size];
  return (
    <span className={cn("text-primary inline-flex items-center gap-2 select-none", className)}>
      <Mark size={s.mark} />
      <span className={cn("font-display text-fg font-semibold tracking-tight lowercase", s.text, compact && "sr-only")}>
        {BRAND_NAME}
      </span>
    </span>
  );
}
