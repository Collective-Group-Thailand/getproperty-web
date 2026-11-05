import { cx as cn } from "../lib/cx";

export interface PolicyTimerProps {
  /** 0–1 of the house's answer window used. */
  fraction: number;
  /** The window has passed: the line turns amber and `caption` says what the house asked for. */
  elapsed: boolean;
  /** Left under the line: "ครบ 3 นาที → ให้ รปภ. โทร". */
  caption: React.ReactNode;
  /** Right under the line: "เหลือ 1:48". */
  remaining?: React.ReactNode;
  /** Accessible name of the line ("เวลาที่บ้านนี้ให้ตอบ"). */
  label: string;
  className?: string;
}

/**
 * The thin progress line under a waiting visit (J-DESIGN §3: "a progress line toward the house policy"). Brand blue
 * while the house can still answer, amber once the window has passed — the words in `caption` carry the meaning,
 * the colour only repeats it.
 */
export function PolicyTimer({ fraction, elapsed, caption, remaining, label, className }: PolicyTimerProps) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="bg-bg-subtle h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-1000 ease-linear",
            elapsed ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={cn(elapsed ? "text-warning-subtle-fg font-medium" : "text-muted")}>{caption}</span>
        {remaining ? <span className="text-muted tabular-nums">{remaining}</span> : null}
      </div>
    </div>
  );
}
