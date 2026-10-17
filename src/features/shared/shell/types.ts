import type { IconName } from "@/ui/icons";

/** A menu entry resolved for rendering: route (locale-prefixed on the owner host), icon, label. */
export interface ShellNavItem {
  key: string;
  href: string;
  icon: IconName;
  label: string;
  group: string;
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
