import { cn } from "../lib/cn";

export interface ViewTab {
  key: string;
  href: string;
  label: React.ReactNode;
  /**
   * Rows this tab shows — the API's `meta.total` for the same query (perPage=1), never counted on the page
   * (REDESIGN-PROMPT §4.4). Omit when the API cannot say.
   */
  count?: number;
  testId?: string;
}

/**
 * View tabs of a list (Open · Overdue · Paid …): links, so each view has its own URL and the server renders it.
 * On phones they become a row of chips that scrolls sideways inside its own box.
 */
export function ViewTabs({
  tabs,
  current,
  label,
  className,
}: {
  tabs: ViewTab[];
  current: string;
  /** Accessible name, from `src/i18n`. */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("relative -mx-1 min-w-0 overflow-x-auto px-1", className)}>
      <ul className="flex w-max items-center gap-1">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key}>
              <a
                href={tab.href}
                aria-current={active ? "page" : undefined}
                data-testid={tab.testId}
                className={cn(
                  "rounded-control duration-fast flex h-9 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-surface text-fg shadow-card ring-border ring-1"
                    : "text-muted hover:bg-bg-subtle hover:text-fg",
                )}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span className={cn("text-xs tabular-nums", active ? "text-fg" : "text-muted")}>{tab.count}</span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The one toolbar of a list (REDESIGN-PROMPT §4.4): view tabs on the left; search, filters, sort and view on the
 * right — one row near the content, sticky when the list is long. On phones the tabs scroll as chips and the
 * controls wrap under them (put rarely used filters in a sheet: `FilterSheet`).
 */
export function ListToolbar({
  tabs,
  search,
  filters,
  actions,
  sticky = false,
  className,
  testId,
}: {
  tabs?: React.ReactNode;
  search?: React.ReactNode;
  filters?: React.ReactNode;
  /** Sort, view switch, export — small, outlined. */
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between",
        sticky && "bg-bg/95 z-sticky sticky top-14 -mx-4 px-4 py-2 backdrop-blur md:top-0 md:-mx-8 md:px-8",
        className,
      )}
      data-testid={testId}
    >
      {tabs ? <div className="min-w-0">{tabs}</div> : null}
      {search || filters || actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
          {search ? <div className="w-full min-w-0 sm:w-64">{search}</div> : null}
          {filters}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Quick filters as links (Today · This week · All): the chosen one marked, each its own URL. */
export function FilterLinks({
  links,
  current,
  label,
}: {
  links: { key: string; href: string; label: React.ReactNode }[];
  current: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="relative min-w-0 overflow-x-auto">
      <ul className="border-border bg-surface rounded-control flex w-max items-center gap-0.5 border p-0.5">
        {links.map((link) => (
          <li key={link.key}>
            <a
              href={link.href}
              aria-current={link.key === current ? "page" : undefined}
              className={cn(
                "rounded-thumb flex h-8 items-center px-3 text-sm font-medium whitespace-nowrap",
                link.key === current ? "bg-primary-subtle text-primary-subtle-fg" : "text-muted hover:text-fg",
              )}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
