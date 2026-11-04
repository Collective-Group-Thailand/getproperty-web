import { cn } from "../lib/cn";

/**
 * A queue beside the item it opens (moderation, reviews): the list on the left, the selected item's full preview and
 * its decision on the right, sticky while the list scrolls. On phones one pane at a time — the list, or the item when
 * one is chosen (the item then carries its own way back to the list).
 */
export function SplitView({
  list,
  detail,
  detailOnPhones = false,
  className,
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  /** An item is chosen: phones show it instead of the list. */
  detailOnPhones?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid items-start gap-6 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:gap-8", className)}>
      <div className={cn("min-w-0", detailOnPhones && "max-lg:hidden")}>{list}</div>
      <div className={cn("min-w-0 lg:sticky lg:top-6", !detailOnPhones && "max-lg:hidden")}>{detail}</div>
    </div>
  );
}
