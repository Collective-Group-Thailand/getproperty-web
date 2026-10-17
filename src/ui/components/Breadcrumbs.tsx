import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface Crumb {
  label: string;
  /** Omit for the current page (the last crumb). */
  href?: string;
}

/**
 * Where am I (design-system.md §3): a `nav` landmark with an ordered list; the current page is
 * `aria-current="page"` and not a link. Separators are decorative.
 */
export function Breadcrumbs({ items, label, className }: { items: Crumb[]; label: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={label} className={cn("text-sm", className)}>
      <ol className="text-muted flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <Icon name="chevron-right" className="text-subtle rtl:rotate-180" /> : null}
              {item.href && !last ? (
                <a href={item.href} className="hover:text-fg underline-offset-4 hover:underline">
                  {item.label}
                </a>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-fg font-medium")}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
