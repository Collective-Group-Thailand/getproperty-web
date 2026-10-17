"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NotificationCentre } from "@/features/shared/notifications/NotificationCentre";
import { LanguageSwitch } from "@/features/shared/shell/LanguageSwitch";
import { isActive } from "@/features/shared/shell/menu";
import { ShellBreadcrumbs } from "@/features/shared/shell/ShellBreadcrumbs";
import { TenantSwitcher } from "@/features/shared/shell/TenantSwitcher";
import type { ShellNavGroup, ShellNavItem } from "@/features/shared/shell/types";
import { UserMenu } from "@/features/shared/shell/UserMenu";
import { useSidebarCollapsed } from "@/features/shared/shell/useSidebarCollapsed";
import { ZoneSidebar } from "@/features/shared/shell/ZoneSidebar";
import type { Schemas } from "@/lib/api/types";
import { Mark, Wordmark } from "@/ui/brand";
import { AppShell, BottomNav, TopBar, type NavItem } from "@/ui/components/AppShell";
import { EnvBadge } from "@/ui/components/EnvBadge";
import { IconButton } from "@/ui/components/IconButton";
import { Icon } from "@/ui/icons";
import { IconMore } from "@/ui/icons/glyphs/more";
import { IconSidebarCollapse } from "@/ui/icons/glyphs/sidebar-collapse";
import { IconSidebarExpand } from "@/ui/icons/glyphs/sidebar-expand";
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
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The owner console frame (F1 1.3 §1): collapsible sidebar from the menu entitlements, top bar
 * (tenant switcher when several, building switcher, global search, notification centre, language,
 * environment badge, user menu), breadcrumbs; on phones a bottom nav — Today, Units, Invoices, Money,
 * More (the whole menu in a sheet).
 */
export function OwnerShellFrame(props: OwnerShellFrameProps) {
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
      sidebarLabel={t("shell.mainNav")}
      sidebarCollapsed={collapsed}
      header={
        <TopBar>
          <IconButton
            icon={collapsed ? IconSidebarExpand : IconSidebarCollapse}
            label={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
            onClick={toggleCollapsed}
            className="hidden md:inline-flex"
          />
          <Link
            href={home?.href ?? `${props.localePrefix}/dashboard`}
            aria-label={t("shell.home")}
            className="shrink-0"
          >
            <Mark size={28} className="text-primary sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">
              <Wordmark size="sm" />
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none" data-testid="session-summary">
            {props.tenants.length > 1 ? (
              <TenantSwitcher zone="owner" tenants={props.tenants} currentTenantId={props.currentTenant.id} />
            ) : (
              <span className="truncate text-sm font-semibold" data-testid="tenant-name">
                {props.currentTenant.displayName}
              </span>
            )}
            <span className="text-muted hidden truncate text-xs lg:inline" data-testid="tenant-role">
              {props.roleLabel}
            </span>
          </div>
          <span className="hidden md:inline-flex">
            <BuildingSwitcher buildings={props.buildings} currentBuildingId={props.currentBuildingId} />
          </span>
          <span className="flex shrink-0 items-center gap-1 md:ms-auto">
            <EnvBadge label={props.envBadge} className="hidden sm:inline" />
            <GlobalSearch items={items} tenantId={props.currentTenant.id} localePrefix={props.localePrefix} />
            <NotificationCentre zone="owner" />
            <span className="hidden md:inline-flex">
              <LanguageSwitch zone="owner" />
            </span>
            <UserMenu displayName={props.userName} roleLabel={props.roleLabel} loginHref={props.loginHref} />
          </span>
        </TopBar>
      }
      sidebar={<ZoneSidebar groups={props.groups} collapsed={collapsed} />}
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
        <ZoneSidebar groups={props.groups} collapsed={false} />
      </LazySheet>
    </AppShell>
  );
}
