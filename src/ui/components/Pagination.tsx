import { Icon } from "../icons";
import { IconChevronLeft } from "../icons/glyphs/chevron-left";
import { IconChevronRight } from "../icons/glyphs/chevron-right";
import { cn } from "../lib/cn";

const ELLIPSIS = "\u2026";

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  perPage: number;
  /** `meta.total` of the API's list answer. */
  total: number;
  /** The link of a page — keeps the list's other search parameters. */
  href: (page: number) => string;
  /** Translated texts: the nav's name, previous, next and "{from}–{to} of {total}". */
  labels: { nav: string; previous: string; next: string; range: string; page: (page: number) => string };
  className?: string;
}

/** Pages of a server-paginated list (contract §3 `meta`), as plain links — no client JavaScript. */
export function Pagination({ page, perPage, total, href, labels, className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const around = [page - 1, page, page + 1].filter((candidate) => candidate >= 1 && candidate <= pages);
  const shown = [...new Set([1, ...around, pages])].sort((a, b) => a - b);
  const link = "rounded-control inline-flex h-9 min-w-9 items-center justify-center px-2 text-sm";
  return (
    <nav aria-label={labels.nav} className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-muted text-sm tabular-nums">{labels.range}</p>
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <a href={href(page - 1)} className={cn(link, "hover:bg-bg-subtle")} rel="prev">
              <Icon icon={IconChevronLeft} />
              <span className="sr-only">{labels.previous}</span>
            </a>
          ) : null}
        </li>
        {shown.map((candidate, index) => (
          <li key={candidate} className="flex items-center gap-1">
            {index > 0 && candidate - shown[index - 1]! > 1 ? (
              <span className="text-muted px-1">{ELLIPSIS}</span>
            ) : null}
            <a
              href={href(candidate)}
              aria-current={candidate === page ? "page" : undefined}
              aria-label={labels.page(candidate)}
              className={cn(
                link,
                "tabular-nums",
                candidate === page ? "bg-primary text-primary-fg font-semibold" : "hover:bg-bg-subtle",
              )}
            >
              {candidate}
            </a>
          </li>
        ))}
        <li>
          {page < pages ? (
            <a href={href(page + 1)} className={cn(link, "hover:bg-bg-subtle")} rel="next">
              <Icon icon={IconChevronRight} />
              <span className="sr-only">{labels.next}</span>
            </a>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
