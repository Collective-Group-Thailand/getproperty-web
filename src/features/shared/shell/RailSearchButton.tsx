"use client";

import { Icon, type IconGlyph } from "@/ui/icons";
import { IconSearch } from "@/ui/icons/glyphs/search";
import { cn } from "@/ui/lib/cn";

/**
 * The search / jump-to trigger of the console column: a 44-px icon on phones and while the column is collapsed, a
 * field-like button with its placeholder from `md` — it opens the dialog, it is not itself an input.
 */
export function RailSearchButton({
  label,
  placeholder,
  onClick,
  collapsed = false,
  icon = IconSearch,
  testId,
}: {
  /** Accessible name ("ค้นหา"). */
  label: string;
  /** What the field-like button reads in the column ("ค้นหาห้อง ผู้เช่า บิล…"). */
  placeholder: string;
  onClick: () => void;
  collapsed?: boolean;
  icon?: IconGlyph;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      className={cn(
        "rounded-control text-muted focus-visible:ring-focus-ring duration-fast inline-flex size-11 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none",
        "hover:bg-bg-subtle hover:text-fg",
        !collapsed &&
          "md:border-border md:bg-surface md:hover:border-border-strong md:hover:bg-surface md:h-10 md:w-full md:justify-start md:gap-2 md:border md:px-3",
      )}
    >
      <Icon icon={icon} className="text-lg" />
      <span className={cn("hidden min-w-0 truncate text-sm", !collapsed && "md:inline")}>{placeholder}</span>
    </button>
  );
}
