import { cn } from "../lib/cn";

/** A loading placeholder shaped like the content it stands in for (design-system.md §4). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("bg-bg-subtle rounded-control animate-pulse", className)} {...props} />;
}

/** Lines of text, for a paragraph or a list row. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
