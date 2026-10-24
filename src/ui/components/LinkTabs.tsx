import { cn } from "../lib/cn";

export interface LinkTab {
  href: string;
  label: React.ReactNode;
  /** A count beside the label (slips to review, open reviews). */
  count?: number;
  testId?: string;
}

export interface LinkTabsProps {
  tabs: LinkTab[];
  /** The `href` of the page being shown. */
  current: string;
  /** Accessible name of the navigation, from `src/i18n`. */
  label: string;
  className?: string;
}

/**
 * Sub-pages of one console section as links that look like tabs (Money: payments · slips · arrears ·
 * credits). Each is its own URL, rendered on the server; the current one is `aria-current="page"`.
 * For panels inside one page use `<Tabs>`.
 */
export function LinkTabs({ tabs, current, label, className }: LinkTabsProps) {
  return (
    <nav aria-label={label} className={cn("border-border relative flex gap-1 overflow-x-auto border-b", className)}>
      {tabs.map((tab) => {
        const active = tab.href === current;
        return (
          <a
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            data-testid={tab.testId}
            className={cn(
              "-mb-px flex h-11 items-center gap-2 border-b-2 px-3 font-medium whitespace-nowrap",
              active ? "border-primary text-fg" : "text-muted hover:text-fg border-transparent",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 ? (
              <span className="bg-neutral-subtle text-neutral-subtle-fg rounded-full px-1.5 text-xs tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
