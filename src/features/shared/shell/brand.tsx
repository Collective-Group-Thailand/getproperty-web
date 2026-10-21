import { Mark, Wordmark } from "@/ui/brand";

/**
 * The logo of a console top bar, rendered by the zone's server shell and handed to its client frame as
 * props: the logo's path data then travels as markup in the RSC payload, never as client JavaScript
 * (design-system.md §7, D-179). Decorative — the enclosing home link carries the accessible name.
 */
export interface ShellBrand {
  /** The full logo (from `sm` up, sidebar expanded). */
  full: React.ReactNode;
  /** The house alone (phones, collapsed sidebar). */
  compact: React.ReactNode;
}

export function shellBrand(): ShellBrand {
  return {
    full: <Wordmark size="sm" decorative />,
    compact: <Mark size="sm" decorative />,
  };
}
