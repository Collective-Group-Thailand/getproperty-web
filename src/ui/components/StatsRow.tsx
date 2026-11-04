import { cn } from "../lib/cn";

export interface Figure {
  key: string;
  label: React.ReactNode;
  /** Already formatted by the caller from the API's own figure (`formatTHB`, `formatNumber`) — never summed here. */
  value: React.ReactNode;
  /** One line under the figure: what it counts, from the API ("จาก 42 ห้อง"). */
  hint?: React.ReactNode;
  /** A figure that opens the rows it counts. */
  href?: string;
  testId?: string;
}

export interface StatsRowProps {
  figures: Figure[];
  /** The one figure that needs attention: brand colour and a pale tint, nothing louder. */
  highlight?: string;
  /** Accessible name of the group, from `src/i18n`. */
  label?: string;
  className?: string;
}

/**
 * The figures row under a page title (REDESIGN-PROMPT §4.3): one card, figures side by side with hairlines between
 * them (two per row on phones), tabular numerals. Figures come from the API only — the page never adds them up.
 */
export function StatsRow({ figures, highlight, label, className }: StatsRowProps) {
  if (figures.length === 0) return null;
  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-card border-border bg-surface shadow-card grid grid-cols-2 overflow-hidden border",
        figures.length >= 3 && "md:grid-cols-3",
        figures.length >= 4 && "lg:grid-cols-4",
        figures.length === 5 && "xl:grid-cols-5",
        figures.length >= 6 && "lg:grid-cols-3 xl:grid-cols-6",
        className,
      )}
    >
      {figures.map((figure) => {
        const marked = figure.key === highlight;
        const body = (
          <>
            <span className={cn("text-sm", marked ? "text-primary-subtle-fg font-medium" : "text-muted")}>
              {figure.label}
            </span>
            <span
              className={cn("text-2xl font-semibold tracking-tight tabular-nums", marked ? "text-primary" : "text-fg")}
            >
              {figure.value}
            </span>
            {figure.hint ? <span className="text-muted text-sm">{figure.hint}</span> : null}
          </>
        );
        const cell = cn(
          "border-border -mt-px -ms-px flex min-w-0 flex-col gap-1 border-s border-t px-5 py-4",
          marked && "bg-primary-subtle",
        );
        return figure.href ? (
          <a
            key={figure.key}
            href={figure.href}
            className={cn(
              cell,
              "hover:bg-bg-subtle duration-fast transition-colors",
              marked && "hover:bg-primary-subtle",
            )}
            data-testid={figure.testId}
          >
            {body}
          </a>
        ) : (
          <div key={figure.key} className={cell} data-testid={figure.testId}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
