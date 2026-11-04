import { Icon, type IconGlyph } from "../icons";
import { cn } from "../lib/cn";

export interface MenuRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconGlyph;
  /** `danger`: sign-out and other leaving actions — red text, never a filled red block. */
  tone?: "default" | "danger";
  /** A muted value at the row's end ("ไทย"). */
  trailing?: React.ReactNode;
}

/**
 * A full-width 48-px list row of a menu sheet (the phone's "More" sheet, the admin menu): icon, label, an optional
 * muted value at the end. A plain row, not a button-looking block — the sheet is a menu, not a task.
 */
export function MenuRow({ icon, tone = "default", trailing, className, children, type, ...props }: MenuRowProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "rounded-control focus-visible:ring-focus-ring flex h-12 w-full items-center gap-3 px-2 text-start font-medium focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
        tone === "danger" ? "text-danger-subtle-fg hover:bg-danger-subtle" : "text-fg hover:bg-bg-subtle",
        className,
      )}
      {...props}
    >
      {icon ? <Icon icon={icon} className={cn("text-lg", tone === "danger" ? undefined : "text-muted")} /> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="text-muted shrink-0 text-sm font-normal">{trailing}</span> : null}
    </button>
  );
}
