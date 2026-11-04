import { Icon, type IconGlyph } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { cn } from "@/ui/lib/cn";

export interface StaffListRow {
  key: string;
  /** The whole row opens its screen. */
  href?: string;
  /** …or opens something in place (the capture flow, a sheet): the row is a button. Client components only. */
  onSelect?: () => void;
  /** A small identifier above the title (a request number, a meter code), set in mono figures. */
  lead?: React.ReactNode;
  title: React.ReactNode;
  /** One muted line: the room, the time, the floor. */
  meta?: React.ReactNode;
  /** Status badge(s), always icon + word. */
  status?: React.ReactNode;
  /** Something at the end before the chevron: a count, a value. */
  aside?: React.ReactNode;
  icon?: IconGlyph;
  testId?: string;
  /** One "⋯" for the row's actions (a sheet on the phone), instead of a link — never a row of buttons. */
  menu?: React.ReactNode;
  /** Test id of the row's link or button itself. */
  actionTestId?: string;
  /** `data-*` attributes for field automation and e2e (`{ type: "parcel" }` → `data-type="parcel"`). */
  data?: Record<string, string | number | boolean | null | undefined>;
}

export interface StaffListGroup {
  key: string;
  /** A quiet label inside the card above its rows (a floor). */
  label?: React.ReactNode;
  labelTestId?: string;
  rows: StaffListRow[];
}

/**
 * The staff PWA's list (redesign G7): one white card per section, hairlines between rows, every row a ≥ 64-px target
 * that opens its screen — no buttons repeated under rows. Rows may be grouped inside the card (floors on a round).
 */
export function StaffList({
  label,
  groups,
  testId,
  className,
}: {
  /** Accessible name of the list, from `src/i18n`. */
  label: string;
  groups: StaffListGroup[];
  testId?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-card border-border bg-surface shadow-card overflow-hidden border", className)}
      data-testid={testId}
    >
      {groups.map((group, index) => (
        <div key={group.key} className={cn(index > 0 && "border-border border-t")}>
          {group.label ? (
            <p className="text-muted px-4 pt-3 pb-1 text-xs font-medium" data-testid={group.labelTestId}>
              {group.label}
            </p>
          ) : null}
          <ul aria-label={label} className="divide-border divide-y">
            {group.rows.map((row) => (
              <StaffListItem key={row.key} row={row} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function dataAttributes(data: StaffListRow["data"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value !== undefined && value !== null) out[`data-${key}`] = String(value);
  }
  return out;
}

function StaffListItem({ row }: { row: StaffListRow }) {
  const body = (
    <>
      {row.icon ? (
        <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-10 shrink-0 items-center justify-center text-xl">
          <Icon icon={row.icon} />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {row.lead ? <span className="text-muted font-mono text-xs tabular-nums">{row.lead}</span> : null}
        <span className="leading-snug font-medium text-pretty">{row.title}</span>
        {row.meta ? <span className="text-muted text-sm">{row.meta}</span> : null}
        {row.status ? <span className="mt-1 flex flex-wrap items-center gap-1.5">{row.status}</span> : null}
      </span>
      {row.aside ? <span className="shrink-0 text-end tabular-nums">{row.aside}</span> : null}
      {row.href || row.onSelect ? (
        <Icon icon={IconChevronRight} size={22} className="text-subtle shrink-0 rtl:rotate-180" />
      ) : null}
    </>
  );
  const classes = "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start";
  const interactive = cn(classes, "hover:bg-bg-subtle/60 duration-fast transition-colors");
  if (row.menu)
    return (
      <li data-testid={row.testId} {...dataAttributes(row.data)} className="flex items-center pe-2">
        <div className={cn(classes, "pe-1")}>{body}</div>
        {row.menu}
      </li>
    );
  return (
    <li data-testid={row.testId} {...dataAttributes(row.data)}>
      {row.href ? (
        <a href={row.href} className={interactive} data-testid={row.actionTestId}>
          {body}
        </a>
      ) : row.onSelect ? (
        <button type="button" onClick={row.onSelect} className={interactive} data-testid={row.actionTestId}>
          {body}
        </button>
      ) : (
        <div className={classes}>{body}</div>
      )}
    </li>
  );
}

/** A section of a staff screen: a heading with an optional count and a quiet action at its end, then its content. */
export function StaffSection({
  id,
  title,
  count,
  end,
  children,
  testId,
  className,
}: {
  id: string;
  title: React.ReactNode;
  count?: number;
  end?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-3", className)} data-testid={testId}>
      <div className="flex min-h-8 items-end justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold">
          {title}
          {count !== undefined ? <span className="text-muted ms-2 font-normal tabular-nums">{count}</span> : null}
        </h2>
        {end}
      </div>
      {children}
    </section>
  );
}

/**
 * The task screens' bottom bar (redesign G7): one filled action within thumb reach, an outlined secondary or "⋯"
 * beside it, a short summary or the last problem above — fixed over the safe area, in the phone column at any width.
 * The screen hides the bottom nav (`staffInnerRoute(…).task`), so the bar sits at the very bottom.
 */
export function StaffActionBar({
  children,
  summary,
  problem,
  testId = "task-bar",
}: {
  children: React.ReactNode;
  /** One short line beside the actions ("6 items left"). */
  summary?: React.ReactNode;
  /** The last refusal or "no signal", right where the next tap goes. */
  problem?: React.ReactNode;
  testId?: string;
}) {
  return (
    <>
      <div aria-hidden="true" className={problem ? "h-40" : "h-24"} />
      <div
        className="border-border bg-surface z-sticky fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)] print:hidden"
        data-testid={testId}
      >
        <div className="max-w-phone mx-auto flex flex-col gap-2 px-4 py-3">
          {problem}
          <div className="flex items-center gap-3">
            {summary ? <div className="text-muted min-w-0 flex-1 text-sm">{summary}</div> : null}
            <div
              className={cn(
                "flex gap-3 [&>*]:min-w-0 [&>*]:px-4",
                summary ? "shrink-0" : "flex-1 [&>*:last-child]:flex-1",
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
