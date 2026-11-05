import { cn } from "../lib/cn";

export interface ShareSegment {
  key: string;
  /** The owner's name — read by screen readers with the share. */
  label: string;
  /** Share in percent as people read it ("60", "33.3334"), already formatted. */
  share: string;
  /** The share as a fraction of the whole (0–1) for the bar's width — from the register's own figure. */
  fraction: number;
}

/**
 * Ownership shares of one unit as a single thin bar (pack J register): one quiet segment per co-owner, separated by a
 * hairline, and the part nobody owns yet left as empty track with its word ("ยังขาด 50%"). Neutral ink only — the bar
 * shows proportion, the status is said in words beside it. Screen readers get the list, not the drawing.
 */
export function ShareBar({
  segments,
  missing,
  label,
  className,
}: {
  segments: ShareSegment[];
  /** "ยังขาด 50%" when the shares do not reach 100 % — shown under the bar, in the warning ink. */
  missing?: React.ReactNode;
  /** Accessible name, from `src/i18n` ("สัดส่วนกรรมสิทธิ์ห้อง A-101"). */
  label: string;
  className?: string;
}) {
  return (
    <figure className={cn("m-0 flex flex-col gap-2", className)} data-testid="share-bar">
      <div aria-hidden="true" className="bg-bg-subtle rounded-thumb flex h-2 overflow-hidden">
        {segments.map((segment, index) => (
          <span
            key={segment.key}
            className={cn(
              "block h-full",
              index % 2 === 0 ? "bg-subtle" : "bg-border-strong",
              index > 0 && "border-surface border-s-2",
            )}
            style={{ width: `${Math.max(0, Math.min(1, segment.fraction)) * 100}%` }}
          />
        ))}
      </div>
      <figcaption className="sr-only">
        {label}: {segments.map((segment) => `${segment.label} ${segment.share}%`).join(", ")}
        {missing ? `, ${typeof missing === "string" ? missing : ""}` : ""}
      </figcaption>
      {missing ? <p className="text-warning-subtle-fg m-0 text-sm font-medium">{missing}</p> : null}
    </figure>
  );
}
