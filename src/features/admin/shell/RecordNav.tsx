"use client";

import { usePathname } from "next/navigation";

import { SidebarNav } from "@/ui/components/AppShell";
import { Skeleton } from "@/ui/components/Skeleton";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChart } from "@/ui/icons/glyphs/chart";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { IconDashboard } from "@/ui/icons/glyphs/dashboard";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconShow } from "@/ui/icons/glyphs/show";
import { IconSparkles } from "@/ui/icons/glyphs/sparkles";
import { IconWallet } from "@/ui/icons/glyphs/wallet";
import { IconWrench } from "@/ui/icons/glyphs/wrench";
import { cn } from "@/ui/lib/cn";

import { tenantSectionHref, type TenantTab } from "../tenants/sections";
import { useRailRecord } from "./recordRail";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RECORD = new RegExp(`^/tenants/(${UUID})(?:/([a-z-]+))?/?$`, "i");

/** The tenant whose pages are open, from the path (`/tenants/{id}` and its sections), or null. */
export function tenantRecordOf(pathname: string | null): string | null {
  return pathname ? (RECORD.exec(pathname)?.[1] ?? null) : null;
}

const ICONS: Record<TenantTab, IconGlyph> = {
  overview: IconDashboard,
  buildings: IconBuilding,
  subscription: IconWallet,
  invoices: IconBill,
  hardware: IconGateway,
  "field-work": IconWrench,
  pilot: IconFlag,
  "ai-usage": IconSparkles,
  flags: IconChart,
  credentials: IconKey,
  support: IconChat,
  view: IconShow,
};

/**
 * The navigation column on a tenant's pages (redesign G8, "tabs folded into the column"): the way back to the list, the
 * record's name with its short key, then its sections as the menu — the tab row is gone. The name comes from the page
 * (`RailRecord`); the sections from the user's permissions, so they render with the page.
 */
export function RecordNav({
  tenantId,
  sections,
  back,
  label,
  size = "md",
  collapsed = false,
}: {
  tenantId: string;
  sections: { key: TenantTab; label: string }[];
  back: { label: string; href: string };
  /** Accessible name of the section list. */
  label: string;
  size?: "md" | "touch";
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const record = useRailRecord();
  const named = record?.id === tenantId ? record : null;
  return (
    <div className="flex flex-col gap-3" data-testid="record-nav">
      {collapsed ? null : (
        <div className={cn("flex flex-col gap-3", size === "md" ? "px-5" : "px-0")}>
          <a
            href={back.href}
            className="text-muted hover:text-fg rounded-control focus-visible:ring-focus-ring -ms-1 inline-flex w-fit items-center gap-1 px-1 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
            data-testid="record-nav-back"
          >
            <Icon icon={IconChevronLeft} className="rtl:rotate-180" />
            {back.label}
          </a>
          <div className="flex min-w-0 flex-col gap-0.5">
            {named ? (
              <>
                <span className="truncate text-base font-semibold" data-testid="record-nav-name">
                  {named.name}
                </span>
                {named.slug ? <span className="text-muted truncate font-mono text-xs">{named.slug}</span> : null}
              </>
            ) : (
              <>
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-24" />
              </>
            )}
          </div>
        </div>
      )}
      <div role="group" aria-label={label} className={cn(size === "touch" && "-mx-3")}>
        <SidebarNav
          collapsed={collapsed}
          size={size}
          items={sections.map((section) => {
            const href = tenantSectionHref(tenantId, section.key);
            return {
              href,
              label: section.label,
              icon: <Icon icon={ICONS[section.key]} />,
              active: pathname === href,
              testId: `tenant-tab-${section.key}`,
            };
          })}
        />
      </div>
    </div>
  );
}
