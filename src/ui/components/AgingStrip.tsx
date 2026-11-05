import { cn } from "../lib/cn";

export interface AgingTile {
  key: string;
  /** "1–30 วัน" — the bucket's range, from `src/i18n`. */
  label: React.ReactNode;
  /** "18 ราย" — accounts or invoices in the bucket, formatted by the caller. */
  count: React.ReactNode;
  /** The bucket's open balance, formatted by the caller from the API's figure (`formatTHB`). */
  amount: React.ReactNode;
  /** A word for the oldest bucket ("เกิน 1 ปี"): a small badge beside the label, never a filled tile. */
  badge?: React.ReactNode;
  href?: string;
  testId?: string;
}

/**
 * Aging strip (J-DESIGN §4): four equal tiles — bucket label, count, amount right-aligned. The oldest bucket gets a
 * danger badge with a word, never a fill colour, so the strip stays calm and readable at a glance. Amounts are the
 * API's; the strip adds nothing up.
 */
export function AgingStrip({
  tiles,
  label,
  className,
}: {
  tiles: AgingTile[];
  /** Accessible name of the strip, from `src/i18n`. */
  label: string;
  className?: string;
}) {
  if (tiles.length === 0) return null;
  return (
    <ul
      aria-label={label}
      className={cn("m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4", className)}
      data-testid="aging-strip"
    >
      {tiles.map((tile) => {
        const body = (
          <>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-muted text-sm">{tile.label}</span>
              {tile.badge ? (
                <span className="rounded-thumb bg-danger-subtle text-danger-subtle-fg px-1.5 py-0.5 text-xs font-medium">
                  {tile.badge}
                </span>
              ) : null}
            </span>
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-lg font-semibold tabular-nums">{tile.count}</span>
              <span className="text-fg text-sm font-medium tabular-nums">{tile.amount}</span>
            </span>
          </>
        );
        const box = "rounded-card border-border bg-surface flex h-full flex-col gap-2 border px-4 py-3";
        return (
          <li key={tile.key} data-testid={tile.testId ?? `aging-${tile.key}`}>
            {tile.href ? (
              <a
                href={tile.href}
                className={cn(box, "hover:border-border-strong focus-visible:outline-focus-ring transition-colors")}
              >
                {body}
              </a>
            ) : (
              <div className={box}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
