"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { SidebarNav } from "@/ui/components/AppShell";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import { currentHref } from "./menu";
import type { ShellNavGroup } from "./types";

/**
 * The console sidebar (owner, admin): grouped entries from the menu entitlements, the current page
 * marked with `aria-current`. Collapsing keeps icons with their labels as tooltips; the choice is
 * remembered per zone in the browser (a convenience, not state).
 */
export function ZoneSidebar({
  groups,
  collapsed,
  size = "md",
}: {
  groups: ShellNavGroup[];
  collapsed: boolean;
  /** `touch` (44-px rows) in the phone menu sheet. */
  size?: "md" | "touch";
}) {
  const pathname = usePathname();
  const items = groups.flatMap((group) => group.items);
  const current = currentHref(
    items.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]),
    pathname,
  );
  const root = useRef<HTMLDivElement>(null);
  // The menu scrolls on its own: bring the open page into view (Money sits below the fold on a short screen).
  useEffect(() => {
    root.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname]);
  return (
    <div className="flex flex-col gap-5" data-testid="zone-sidebar" ref={root}>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`nav-group-${group.key}`}>
          <h2
            id={`nav-group-${group.key}`}
            className={cn("text-muted px-5 pb-1.5 text-xs font-medium", collapsed && "sr-only")}
          >
            {group.label}
          </h2>
          <SidebarNav
            collapsed={collapsed}
            size={size}
            items={group.items.map((item) => {
              const open = item.href === current || Boolean(item.children?.some((child) => child.href === current));
              return {
                href: item.href,
                label: item.label,
                icon: <Icon icon={item.icon} />,
                active: open,
                children: open
                  ? item.children?.map((child) => ({ ...child, active: child.href === current }))
                  : undefined,
              };
            })}
          />
        </section>
      ))}
    </div>
  );
}
