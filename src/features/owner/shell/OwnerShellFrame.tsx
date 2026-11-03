"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NotificationCentre } from "@/features/shared/notifications/NotificationCentre";
import { LanguageSwitch } from "@/features/shared/shell/LanguageSwitch";
import type { ShellBrand } from "@/features/shared/shell/brand";
import { ConsoleRail, RailWorkspace } from "@/features/shared/shell/ConsoleRail";
import { isActive } from "@/features/shared/shell/menu";
import { ShellBreadcrumbs } from "@/features/shared/shell/ShellBreadcrumbs";
import { TenantSwitcher } from "@/features/shared/shell/TenantSwitcher";
import type { ShellNavGroup, ShellNavItem } from "@/features/shared/shell/types";
import { UserMenu } from "@/features/shared/shell/UserMenu";
import { useSidebarCollapsed } from "@/features/shared/shell/useSidebarCollapsed";
import { ZoneSidebar } from "@/features/shared/shell/ZoneSidebar";
import type { Schemas } from "@/lib/api/types";
import { AppShell, BottomNav, type NavItem } from "@/ui/components/AppShell";
import { EnvBadge } from "@/ui/components/EnvBadge";
import { Icon } from "@/ui/icons";
import { IconMore } from "@/ui/icons/glyphs/more";
import { LazySheet } from "@/ui/components/overlays";

import { BuildingSwitcher } from "./BuildingSwitcher";
import { GlobalSearch } from "./GlobalSearch";

export interface OwnerShellFrameProps {
  tenants: Schemas["OperatorTenantDto"][];
  currentTenant: Schemas["CurrentTenantDto"];
  userName: string;
  roleLabel: string;
  groups: ShellNavGroup[];
  bottomNav: { item: ShellNavItem; label: string }[];
  buildings: Schemas["BuildingDto"][];
  currentBuildingId: string | null;
  envBadge?: string;
  localePrefix: string;
  loginHref: string;
  /** The logo, rendered by the server shell (`shellBrand()`). */
  brand: ShellBrand;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The owner console frame (redesign G0): one navigation column (ConsoleRail) — logo, organisation and role, building
 * switcher, search, the menu from the entitlements, and notifications, language and the account pinned at the bottom;
 * a back link on record pages instead of breadcrumbs. On phones the column is the top bar and a bottom nav — Today,
 * Units, Invoices, Money, More (the whole menu in a sheet).
 */
export function OwnerShellFrame(props: OwnerShellFrameProps) {
  // Marks the document interactive (hydrated): the e2e suite waits for it instead of clicking
  // server-rendered buttons that do nothing yet (the SSE stream keeps the network busy).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "owner";
  }, []);
  const t = useTranslations();
  const pathname = usePathname();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed("owner");
  const [moreOpen, setMoreOpen] = useState(false);
  const items = props.groups.flatMap((group) => group.items);
  const home = items.find((item) => item.key === "dashboard");

  const bottom: NavItem[] = [
    ...props.bottomNav.map(({ item, label }) => ({
      href: item.href,
      label,
      icon: <Icon icon={item.icon} />,
      active: isActive(item.href, pathname),
    })),
    {
      href: "#more",
      label: t("owner.nav.bottom.more"),
      icon: <Icon icon={IconMore} />,
      onSelect: () => setMoreOpen(true),
    },
  ];

  return (
    <AppShell
      skipLabel={t("shell.skipToContent")}
      rail={
        <ConsoleRail
          brand={props.brand}
          homeHref={home?.href ?? `${props.localePrefix}/dashboard`}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          navLabel={t("shell.mainNav")}
          workspace={
            <RailWorkspace
              name={props.currentTenant.displayName}
              nameTestId="tenant-name"
              role={props.roleLabel}
              roleTestId="tenant-role"
              switcher={
                props.tenants.length > 1 ? (
                  <TenantSwitcher
                    zone="owner"
                    variant="rail"
                    roleLabel={props.roleLabel}
                    tenants={props.tenants}
                    currentTenantId={props.currentTenant.id}
                  />
                ) : undefined
              }
              extra={<BuildingSwitcher buildings={props.buildings} currentBuildingId={props.currentBuildingId} />}
            />
          }
          search={
            <GlobalSearch
              items={items}
              tenantId={props.currentTenant.id}
              localePrefix={props.localePrefix}
              collapsed={collapsed}
            />
          }
          nav={<ZoneSidebar groups={props.groups} collapsed={collapsed} />}
          tools={
            <>
              <EnvBadge label={props.envBadge} className="hidden md:inline" />
              <NotificationCentre zone="owner" />
              <span className="hidden md:inline-flex">
                <LanguageSwitch zone="owner" />
              </span>
            </>
          }
          account={
            <UserMenu
              variant="rail"
              collapsed={collapsed}
              displayName={props.userName}
              roleLabel={props.roleLabel}
              loginHref={props.loginHref}
            />
          }
        />
      }
      bottomNav={<BottomNav items={bottom} label={t("shell.bottomNav")} />}
    >
      {props.banner}
      <ShellBreadcrumbs items={items} home={home}>
        {props.children}
      </ShellBreadcrumbs>
      <LazySheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title={t("shell.moreMenu")}
        closeLabel={t("common.close")}
        side="bottom"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 md:hidden">
          <BuildingSwitcher buildings={props.buildings} currentBuildingId={props.currentBuildingId} />
          <LanguageSwitch zone="owner" />
        </div>
        <ZoneSidebar groups={props.groups} collapsed={false} size="touch" />
      </LazySheet>
    </AppShell>
  );
}
