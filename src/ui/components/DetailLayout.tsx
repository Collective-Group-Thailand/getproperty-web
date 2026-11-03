import { cn } from "../lib/cn";

/**
 * A record page (REDESIGN-PROMPT §4.6): the facts or the document on the left, the sticky next-steps panel on the
 * right. On phones the panel comes first (`panelFirstOnPhones`, default) so the next step is the first thing seen.
 */
export function DetailLayout({
  children,
  panel,
  panelFirstOnPhones = true,
  className,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
  panelFirstOnPhones?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8", className)}>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      <aside className={cn("lg:sticky lg:top-6", panelFirstOnPhones && "-order-1 lg:order-none")}>{panel}</aside>
    </div>
  );
}

export interface PanelStep {
  key: string;
  label: React.ReactNode;
  value?: React.ReactNode;
}

/**
 * The next-steps panel: what the record needs next, then its actions — one filled lead action, the others outlined,
 * the destructive one last, rare ones behind "⋯" (pass a `DropdownMenu` as `more`). `facts` are the few key figures
 * (amount due, dates) in tabular numerals.
 */
export function ActionPanel({
  title,
  status,
  description,
  facts,
  primary,
  secondary,
  destructive,
  more,
  footer,
  className,
  testId,
}: {
  title: React.ReactNode;
  status?: React.ReactNode;
  description?: React.ReactNode;
  facts?: PanelStep[];
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  destructive?: React.ReactNode;
  more?: React.ReactNode;
  /** Who did what and when (approval flows), under the actions. */
  footer?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      className={cn("rounded-card border-border bg-surface shadow-card flex flex-col border", className)}
      data-testid={testId}
    >
      <div className="flex flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {more}
        </div>
        {status ? <div className="flex flex-wrap gap-1.5">{status}</div> : null}
        {description ? <p className="text-muted text-sm">{description}</p> : null}
      </div>
      {facts && facts.length > 0 ? (
        <dl className="border-border flex flex-col gap-2 border-t px-5 py-4">
          {facts.map((fact) => (
            <div key={fact.key} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-muted">{fact.label}</dt>
              <dd className="text-fg text-end font-medium tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {primary || secondary || destructive ? (
        <div className="border-border flex flex-col gap-2 border-t p-5 [&>*]:w-full">
          {primary}
          {secondary}
          {destructive ? <div className="border-border mt-2 border-t pt-3 [&>*]:w-full">{destructive}</div> : null}
        </div>
      ) : null}
      {footer ? <div className="border-border text-muted border-t px-5 py-4 text-sm">{footer}</div> : null}
    </section>
  );
}
