"use client";

import { usePathname } from "next/navigation";

import { SidebarNav } from "@/ui/components/AppShell";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { isActive } from "./menu";
import type { ShellNavGroup } from "./types";

/**
 * The console sidebar (owner, admin): grouped entries from the menu entitlements, the current page
 * marked with `aria-current`. Collapsing keeps icons with their labels as tooltips; the choice is
 * remembered per zone in the browser (a convenience, not state).
 */
export function ZoneSidebar({ groups, collapsed }: { groups: ShellNavGroup[]; collapsed: boolean }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-4" data-testid="zone-sidebar">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`nav-group-${group.key}`}>
          <h2
            id={`nav-group-${group.key}`}
            className={cn("text-muted px-5 pb-1 text-xs font-semibold tracking-wide uppercase", collapsed && "sr-only")}
          >
            {group.label}
          </h2>
          <SidebarNav
            collapsed={collapsed}
            items={group.items.map((item) => ({
              href: item.href,
              label: item.label,
              icon: <Icon icon={item.icon} />,
              active: isActive(item.href, pathname),
            }))}
          />
        </section>
      ))}
    </div>
  );
}
