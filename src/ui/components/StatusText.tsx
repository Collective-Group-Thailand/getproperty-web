import { Icon, type IconGlyph } from "../icons";
import { cn } from "../lib/cn";

const TONE = {
  neutral: "text-fg",
  muted: "text-muted",
  info: "text-info-subtle-fg",
  success: "text-success-subtle-fg",
  warning: "text-warning-subtle-fg",
  danger: "text-danger-subtle-fg",
} as const;

/**
 * A state in words inside a dense row, where a filled badge would be too loud (G4: an SLA clock "เกิน SLA 6 ชม.", a
 * TM30 deadline, "ข้อมูลไม่ครบ"): an icon and the words in the tone's ink, an optional muted line beneath (the due
 * time). Colour is never the only signal — the icon and the words carry the meaning too.
 */
export function StatusText({
  tone = "neutral",
  icon,
  children,
  detail,
  size = "sm",
  className,
  testId,
  state,
}: {
  tone?: keyof typeof TONE;
  icon?: IconGlyph;
  children: React.ReactNode;
  /** A muted line under the words (an absolute time, a reference). */
  detail?: React.ReactNode;
  /** `sm` in table rows; `md` at the head of a panel. */
  size?: "sm" | "md";
  className?: string;
  testId?: string;
  /** `data-state` for the e2e suite. */
  state?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)} data-testid={testId} data-state={state}>
      <span
        className={cn(
          "inline-flex items-start gap-1.5 font-medium",
          size === "md" ? "text-base" : "text-sm",
          TONE[tone],
        )}
      >
        {icon ? <Icon icon={icon} className={cn("mt-[0.2em] shrink-0", tone === "neutral" && "text-subtle")} /> : null}
        <span>{children}</span>
      </span>
      {detail ? <span className="text-muted text-sm tabular-nums">{detail}</span> : null}
    </span>
  );
}
