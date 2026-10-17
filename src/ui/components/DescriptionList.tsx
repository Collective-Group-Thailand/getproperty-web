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
  className?: string;
}

/**
 * Label/value pairs of one record (design-system.md §3 "DescriptionList"): a building's address and
 * accounts, a lease's terms, an invoice's disclosure. A real `<dl>` so a screen reader announces each
 * term with its value; server-renderable (no client JavaScript).
 */
export function DescriptionList({ items, columns = 2, className }: DescriptionListProps) {
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
