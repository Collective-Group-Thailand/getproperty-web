import { Icon } from "../icons";
import { IconChevronRight } from "../icons/glyphs/chevron-right";
import { cn } from "../lib/cn";

export interface RowListItem {
  key: string;
  /** The row opens its record. */
  href?: string;
  /** Leading identifier: a unit code, a document number — set in tabular figures. */
  lead?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Status badge(s). */
  status?: React.ReactNode;
  /** The figure at the end of the row (money right-aligned). */
  figure?: React.ReactNode;
  /** One "⋯" menu for secondary actions — never a row of buttons. */
  menu?: React.ReactNode;
  testId?: string;
}

/**
 * A list of records as rows (REDESIGN-PROMPT §4.5): one card, hairlines between rows, the whole row opens the record.
 * On phones the row stacks: identifier and status on top, title, then the figure — a card per row without boxes
 * inside boxes.
 */
export function RowList({
  items,
  label,
  empty,
  className,
  testId,
}: {
  items: RowListItem[];
  /** Accessible name of the list, from `src/i18n`. */
  label: string;
  /** Rendered instead of the list when there are no rows: an `EmptyState` with its action. */
  empty?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  if (items.length === 0 && empty) return <>{empty}</>;
  return (
    <ul
      aria-label={label}
      className={cn("rounded-card border-border bg-surface shadow-card divide-border divide-y border", className)}
      data-testid={testId}
    >
      {items.map((item) => {
        const body = (
          <>
            {item.lead ? (
              <span className="text-fg w-auto shrink-0 font-mono text-sm font-medium tabular-nums md:w-20">
                {item.lead}
              </span>
            ) : null}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{item.title}</span>
              {item.meta ? <span className="text-muted truncate text-sm">{item.meta}</span> : null}
            </span>
            {item.status ? (
              <span className="flex flex-wrap items-center gap-1.5 md:justify-end">{item.status}</span>
            ) : null}
            {item.figure ? (
              <span className="shrink-0 text-end font-medium tabular-nums md:min-w-28">{item.figure}</span>
            ) : null}
          </>
        );
        return (
          <li key={item.key} className="relative flex items-center gap-2 pe-2" data-testid={item.testId}>
            {item.href ? (
              <a
                href={item.href}
                className="hover:bg-bg-subtle/60 duration-fast flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors md:flex-nowrap md:px-5"
              >
                {body}
                <Icon icon={IconChevronRight} className="text-subtle hidden shrink-0 md:block rtl:rotate-180" />
              </a>
            ) : (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 md:flex-nowrap md:px-5">
                {body}
              </div>
            )}
            {item.menu ? <span className="shrink-0">{item.menu}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
