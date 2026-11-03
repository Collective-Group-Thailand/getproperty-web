import { Icon, type IconGlyph } from "../icons";
import { IconBuilding } from "../icons/glyphs/building";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  icon?: IconGlyph;
  /** What is missing *and* why it matters ("ยังไม่มีห้อง — เพิ่มห้องจาก Excel ใน 1 นาที"). */
  title: React.ReactNode;
  /** One sentence. */
  description?: React.ReactNode;
  /**
   * The one next step (REDESIGN-PROMPT §4.9) — required in practice: `src/ui/dead-ends.test.ts` fails on an
   * `EmptyState` without it (a filtered list offers "clear filters", a finished queue offers where to go next).
   */
  action?: React.ReactNode;
  /** `plain` (default): inside a card or table that already has a border; `card`: a centred card of its own. */
  variant?: "card" | "plain";
  className?: string;
}

/** The status / empty card: centred, a thin-line icon, a title, one sentence and the primary next step. */
export function EmptyState({
  icon = IconBuilding,
  title,
  description,
  action,
  variant = "plain",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-12 text-center md:py-16",
        variant === "card" && "rounded-card border-border bg-surface shadow-card border",
        className,
      )}
    >
      <span className="border-border text-muted bg-bg mb-5 grid size-12 place-items-center rounded-full border text-2xl">
        <Icon icon={icon} />
      </span>
      <h2 className="text-lg font-semibold text-balance">{title}</h2>
      {description ? <p className="text-muted mt-1.5 max-w-md text-base text-pretty">{description}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
