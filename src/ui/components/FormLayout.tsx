import { cn } from "../lib/cn";

/**
 * A long form (REDESIGN-PROMPT §4.8): numbered sections on the left, a sticky summary with the save action on the
 * right from `lg`; on phones the summary follows the form and the save sits in `MobileActionBar`.
 */
export function FormColumns({
  children,
  summary,
  className,
}: {
  children: React.ReactNode;
  summary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8", className)}>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      {summary ? <aside className="lg:sticky lg:top-6">{summary}</aside> : null}
    </div>
  );
}

/** One numbered section of a form: number, title, one line of help, then its fields (label above each field). */
export function FormSection({
  number,
  title,
  description,
  children,
  aside,
  className,
  testId,
}: {
  number?: number;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** A small action at the section's head ("Copy from last lease"). */
  aside?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn("rounded-card border-border bg-surface shadow-card border", className)} data-testid={testId}>
      <header className="border-border flex items-start justify-between gap-4 border-b px-5 py-4 md:px-6">
        <div className="flex min-w-0 gap-3">
          {number !== undefined ? (
            <span
              aria-hidden="true"
              className="bg-primary-subtle text-primary-subtle-fg grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums"
            >
              {number}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? <p className="text-muted mt-0.5 text-sm">{description}</p> : null}
          </div>
        </div>
        {aside}
      </header>
      <div className="flex flex-col gap-5 px-5 py-5 md:px-6">{children}</div>
    </section>
  );
}

/**
 * The summary beside a form: what will be saved, live totals (from the API's preview only, never computed here) and
 * the save action — hidden on phones when `MobileActionBar` carries the same action.
 */
export function FormSummary({
  title,
  rows,
  total,
  action,
  note,
  className,
}: {
  title: React.ReactNode;
  rows?: { key: string; label: React.ReactNode; value: React.ReactNode }[];
  total?: { label: React.ReactNode; value: React.ReactNode };
  action?: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-card border-border bg-surface shadow-card flex flex-col border", className)}>
      <h2 className="px-5 pt-5 text-base font-semibold">{title}</h2>
      {rows && rows.length > 0 ? (
        <dl className="flex flex-col gap-2 px-5 pt-4 text-sm">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">{row.label}</dt>
              <dd className="text-end tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {total ? (
        <div className="border-border mx-5 mt-4 flex items-baseline justify-between gap-4 border-t pt-3">
          <span className="font-medium">{total.label}</span>
          <span className="text-xl font-semibold tabular-nums">{total.value}</span>
        </div>
      ) : null}
      {action ? <div className="hidden p-5 md:block [&>*]:w-full">{action}</div> : <div className="pb-5" />}
      {note ? <p className="text-muted border-border border-t px-5 py-3 text-xs">{note}</p> : null}
    </section>
  );
}

/** A save bar that stays at the bottom of a long settings or form section on desktop. */
export function StickySave({
  children,
  status,
  className,
}: {
  children: React.ReactNode;
  /** "Saved 2 minutes ago", "Unsaved changes" — from `src/i18n`. */
  status?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface/95 z-sticky sticky bottom-0 -mx-5 mt-2 hidden items-center justify-end gap-3 border-t px-5 py-3 backdrop-blur md:-mx-6 md:flex md:px-6",
        className,
      )}
    >
      {status ? <span className="text-muted me-auto text-sm">{status}</span> : null}
      {children}
    </div>
  );
}

/**
 * The phone's bottom action bar (REDESIGN-PROMPT §4.10): the page's primary action within thumb reach, above the
 * bottom nav and the safe area. Hidden from `md`, where the summary or the panel carries the action.
 */
export function MobileActionBar({
  children,
  summary,
  aboveNav = true,
  className,
}: {
  children: React.ReactNode;
  /** One short line beside the action (the total, the selection). */
  summary?: React.ReactNode;
  /** The console has a bottom nav on phones: sit above it. */
  aboveNav?: boolean;
  className?: string;
}) {
  return (
    <>
      <div aria-hidden="true" className="h-20 md:hidden" />
      <div
        className={cn(
          "border-border bg-surface z-sticky fixed inset-x-0 flex items-center gap-3 border-t px-4 py-3 md:hidden",
          aboveNav ? "bottom-(--bottom-nav-h)" : "bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
          className,
        )}
        data-testid="mobile-action-bar"
      >
        {summary ? <div className="min-w-0 flex-1 truncate text-sm">{summary}</div> : null}
        <div className={cn("flex gap-2", summary ? "shrink-0" : "flex-1 [&>*]:flex-1")}>{children}</div>
      </div>
    </>
  );
}
