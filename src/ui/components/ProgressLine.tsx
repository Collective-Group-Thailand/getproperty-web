import { cn } from "../lib/cn";

/**
 * A thin progress line (approvals given of required, statement lines settled, a petty cash float used): drawing only —
 * the caller passes a share it read from the API's counts and says the figure in words beside it. Brand blue for the
 * part done, the subtle track for the rest; `tone="neutral"` when the line is information, not progress.
 */
export function ProgressLine({
  share,
  label,
  tone = "primary",
  className,
  testId,
}: {
  /** 0–1 (clamped). */
  share: number;
  /** What the line shows, for screen readers ("อนุมัติแล้ว 1 จาก 2"). */
  label: string;
  tone?: "primary" | "neutral";
  className?: string;
  testId?: string;
}) {
  const value = Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("bg-bg-subtle rounded-thumb block h-1.5 w-full overflow-hidden", className)}
      data-testid={testId}
      data-share={value.toFixed(3)}
    >
      <span
        className={cn("rounded-thumb block h-full", tone === "primary" ? "bg-primary" : "bg-border-strong")}
        style={{ width: `${(value * 100).toFixed(1)}%` }}
      />
    </span>
  );
}
