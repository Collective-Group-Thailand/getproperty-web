import type { IconGlyph } from "@/ui/icons";

/** A menu entry resolved for rendering: route (locale-prefixed on the owner host), icon, label. */
export interface ShellNavItem {
  key: string;
  href: string;
  icon: IconGlyph;
  label: string;
  group: string;
  /** The section's own pages, shown under the entry while the section is open (redesign G3: no sub-tabs). */
  children?: readonly ShellNavChild[];
}

/** A page of a menu section (billing cycle, invoices; leases, contract library…), resolved for rendering. */
export interface ShellNavChild {
  key: string;
  href: string;
  label: string;
  testId?: string;
}

export interface ShellNavGroup {
  key: string;
  label: string;
  items: ShellNavItem[];
}

export function groupItems(
  items: ShellNavItem[],
  groups: readonly string[],
  labels: Record<string, string>,
): ShellNavGroup[] {
  return groups
    .map((group) => ({
      key: group,
      label: labels[group] ?? group,
      items: items.filter((item) => item.group === group),
    }))
    .filter((group) => group.items.length > 0);
}
