import { cn } from "../lib/cn";

/**
 * The bar of a list's selected rows (J-DESIGN §3 "bulk bar"): a white bar with a hairline on the pale brand tint, the
 * selection in words on the left, the actions on the right, "clear" last — never a dark block. It sits above the
 * table and stays in view while the list scrolls (`sticky`). On phones the actions wrap under the selection.
 */
export function BulkBar({
  selection,
  actions,
  clear,
  label,
  className,
  testId,
}: {
  /** "เลือกแล้ว 3 ราย · ยอดค้าง ฿148,800.00" — composed by the caller from the API's figures. */
  selection: React.ReactNode;
  actions: React.ReactNode;
  /** The "clear selection" control. */
  clear?: React.ReactNode;
  /** Accessible name of the toolbar, from `src/i18n`. */
  label: string;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        "border-primary/25 bg-primary-subtle rounded-card z-sticky sticky top-14 flex flex-col gap-3 border px-4 py-3 md:top-2 md:flex-row md:items-center md:justify-between",
        className,
      )}
      data-testid={testId}
    >
      <div className="text-primary-subtle-fg min-w-0 text-sm font-medium tabular-nums" aria-live="polite">
        {selection}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {clear ? <span className="border-primary/20 ms-1 border-s ps-3">{clear}</span> : null}
      </div>
    </div>
  );
}
