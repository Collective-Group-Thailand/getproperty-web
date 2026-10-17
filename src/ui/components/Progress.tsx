import { cn } from "../lib/cn";

export interface ProgressProps {
  /** Done so far (≥ 0). */
  value: number;
  /** The whole (> 0); with 0 the bar is empty. */
  max: number;
  /** Accessible name ("Reading round"). */
  label: string;
  /** Human text for assistive tech and the caption ("8 of 20 read"). */
  valueText: string;
  /** Show `valueText` under the bar. */
  showCaption?: boolean;
  className?: string;
}

/**
 * A determinate progress bar (round progress, upload progress) — WAI-ARIA `progressbar` with a text
 * value, so the number is announced, not just drawn. Colour is never the only signal: the caption says
 * the same thing in words.
 */
export function Progress({ value, max, label, valueText, showCaption = true, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(value, max));
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
        className="bg-bg-subtle h-3 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-primary duration-slow ease-standard h-full rounded-full transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showCaption ? <p className="text-muted text-sm tabular-nums">{valueText}</p> : null}
    </div>
  );
}
