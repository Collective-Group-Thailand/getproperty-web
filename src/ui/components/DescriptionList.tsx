import { cn } from "../lib/cn";

export interface DescriptionItem {
  /** Stable key (the field name). */
  id: string;
  term: React.ReactNode;
  /** Already formatted (money with `formatTHB`, dates with `formatDate`); `null` renders an em dash. */
  description: React.ReactNode | null;
  /** Spans both columns on wide screens (an address, a note). */
  wide?: boolean;
}

export interface DescriptionListProps {
  items: DescriptionItem[];
  columns?: 1 | 2 | 3;
  /**
   * `stacked` (default): the term above its value, in columns. `rows`: one fact per row — the term on the left, the
   * value beside it, hairlines between rows (a settings card, a document's facts).
   */
  layout?: "stacked" | "rows";
  className?: string;
}

/**
 * Label/value pairs of one record (design-system.md §3 "DescriptionList"): a building's address and
 * accounts, a lease's terms, an invoice's disclosure. A real `<dl>` so a screen reader announces each
 * term with its value; server-renderable (no client JavaScript).
 */
export function DescriptionList({ items, columns = 2, layout = "stacked", className }: DescriptionListProps) {
  if (layout === "rows")
    return (
      <dl className={cn("divide-border flex flex-col divide-y", className)}>
        {items.map((item) => (
          <div
            key={item.id}
            className="flex min-w-0 flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[minmax(9rem,14rem)_minmax(0,1fr)] sm:gap-6"
          >
            <dt className="text-muted text-sm sm:text-base">{item.term}</dt>
            <dd className="min-w-0 font-medium break-words">{item.description ?? "—"}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.id} className={cn("flex min-w-0 flex-col gap-0.5", item.wide && "sm:col-span-full")}>
          <dt className="text-muted text-sm">{item.term}</dt>
          <dd className="min-w-0 break-words">{item.description ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
