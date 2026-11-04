"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NotificationCentre } from "@/features/shared/notifications/NotificationCentre";
import type { ShellBrand } from "@/features/shared/shell/brand";
import { ConsoleRail, RailWorkspace } from "@/features/shared/shell/ConsoleRail";
import { LanguageSwitch } from "@/features/shared/shell/LanguageSwitch";
import { ShellBreadcrumbs } from "@/features/shared/shell/ShellBreadcrumbs";
import type { ShellNavGroup } from "@/features/shared/shell/types";
import { UserMenu } from "@/features/shared/shell/UserMenu";
import { useSidebarCollapsed } from "@/features/shared/shell/useSidebarCollapsed";
import { ZoneSidebar } from "@/features/shared/shell/ZoneSidebar";
import { AppShell } from "@/ui/components/AppShell";
import { LazySheet } from "@/ui/components/overlays";
import { Badge } from "@/ui/components/Badge";
import { EnvBadge } from "@/ui/components/EnvBadge";
import { IconButton } from "@/ui/components/IconButton";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconMenu } from "@/ui/icons/glyphs/menu";

import type { TenantTab } from "../tenants/sections";
import { CommandPalette } from "./CommandPalette";
import { RecordNav, tenantRecordOf } from "./RecordNav";

export interface AdminShellFrameProps {
  userName: string;
  /** The phone top bar's title ("แอดมิน Collective"): the person's name lives in the account menu there. */
  zoneLabel: string;
  rolesLabel: string;
  groups: ShellNavGroup[];
  envBadge?: string;
  /** From `GET /v1/admin/system/info`: the API runs with in-memory fakes. */
  apiFakes: boolean;
  fakesLabel: string;
  /** The logo, rendered by the server shell (`shellBrand()`). */
  brand: ShellBrand;
  /** The sections of a tenant record this user may open, labelled (the column's menu on a tenant's pages). */
  tenantSections: { key: TenantTab; label: string }[];
  recordLabels: { back: string; nav: string };
  children: React.ReactNode;
}

/**
 * The admin console frame (redesign G0): the one navigation column (ConsoleRail) from `/v1/admin/me` entitlements —
 * who is signed in, environment, jump-to, the menu, notifications and the account; on phones the column is the top
 * bar and the menu opens in a sheet.
 */
export function AdminShellFrame(props: AdminShellFrameProps) {
  // Marks the document interactive (hydrated): the e2e suite waits for it instead of clicking
  // server-rendered buttons that do nothing yet (the SSE stream keeps the network busy).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "admin";
  }, []);
  const t = useTranslations();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed("admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const items = props.groups.flatMap((group) => group.items);
  // On a tenant's pages the column becomes the record: the way back, its name, its sections (redesign G8).
  const record = tenantRecordOf(usePathname());
  const recordNav = (size: "md" | "touch") =>
    record ? (
      <RecordNav
        tenantId={record}
        sections={props.tenantSections}
        back={{ label: props.recordLabels.back, href: "/tenants" }}
        label={props.recordLabels.nav}
        size={size}
        collapsed={size === "md" && collapsed}
      />
    ) : null;
  return (
    <AppShell
      skipLabel={t("shell.skipToContent")}
      rail={
        <ConsoleRail
          brand={props.brand}
          homeHref="/"
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          navLabel={t("shell.mainNav")}
          mobileMenu={<IconButton icon={IconMenu} label={t("shell.moreMenu")} onClick={() => setMenuOpen(true)} />}
          workspace={
            <>
              <span className="truncate text-sm font-semibold md:hidden">{props.zoneLabel}</span>
              <div className="max-md:hidden">
                <RailWorkspace
                  name={props.userName}
                  nameTestId="platform-user"
                  role={props.rolesLabel}
                  roleTestId="platform-roles"
                />
              </div>
              {props.apiFakes || props.envBadge ? (
                <div className="hidden flex-wrap items-center gap-1 md:flex">
                  <EnvBadge label={props.envBadge} />
                  {props.apiFakes ? (
                    <Badge tone="info" size="sm" icon={IconInfo}>
                      {props.fakesLabel}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </>
          }
          search={<CommandPalette items={items} collapsed={collapsed} />}
          nav={recordNav("md") ?? <ZoneSidebar groups={props.groups} collapsed={collapsed} />}
          tools={
            <>
              <NotificationCentre zone="admin" />
              <span className="hidden md:inline-flex">
                <LanguageSwitch zone="admin" />
              </span>
            </>
          }
          account={
            <UserMenu
              variant="rail"
              collapsed={collapsed}
              displayName={props.userName}
              roleLabel={props.rolesLabel}
              loginHref="/login"
            />
          }
        />
      }
    >
      <ShellBreadcrumbs items={items} home={undefined}>
        {props.children}
      </ShellBreadcrumbs>
      <LazySheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t("shell.moreMenu")}
        closeLabel={t("common.close")}
        side="left"
      >
        <div className="flex flex-col gap-5">
          {props.apiFakes || props.envBadge ? (
            <div className="flex flex-wrap items-center gap-1">
              <EnvBadge label={props.envBadge} />
              {props.apiFakes ? (
                <Badge tone="info" size="sm" icon={IconInfo}>
                  {props.fakesLabel}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {record ? <div className="border-border border-b pb-4">{recordNav("touch")}</div> : null}
          <ZoneSidebar groups={props.groups} collapsed={false} size="touch" />
          <div className="border-border border-t pt-4">
            <LanguageSwitch zone="admin" />
          </div>
        </div>
      </LazySheet>
    </AppShell>
  );
}
