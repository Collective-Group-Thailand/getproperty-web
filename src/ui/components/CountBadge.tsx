import { cn } from "../lib/cn";

/**
 * A small count on an icon button (unread notifications, queued readings). Decorative for assistive
 * tech — the button's own label carries the count ("การแจ้งเตือน, ยังไม่อ่าน 3").
 */
export function CountBadge({ count, max = 99, className }: { count: number; max?: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-primary text-primary-fg absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums",
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
