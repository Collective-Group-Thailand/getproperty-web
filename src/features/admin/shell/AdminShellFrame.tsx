"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { NotificationCentre } from "@/features/shared/notifications/NotificationCentre";
import { LanguageSwitch } from "@/features/shared/shell/LanguageSwitch";
import { ShellBreadcrumbs } from "@/features/shared/shell/ShellBreadcrumbs";
import type { ShellNavGroup } from "@/features/shared/shell/types";
import { UserMenu } from "@/features/shared/shell/UserMenu";
import { useSidebarCollapsed } from "@/features/shared/shell/useSidebarCollapsed";
import { ZoneSidebar } from "@/features/shared/shell/ZoneSidebar";
import { Wordmark } from "@/ui/brand";
import { AppShell, TopBar } from "@/ui/components/AppShell";
import { Badge } from "@/ui/components/Badge";
import { EnvBadge } from "@/ui/components/EnvBadge";
import { IconButton } from "@/ui/components/IconButton";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconSidebarCollapse } from "@/ui/icons/glyphs/sidebar-collapse";
import { IconSidebarExpand } from "@/ui/icons/glyphs/sidebar-expand";

import { CommandPalette } from "./CommandPalette";

export interface AdminShellFrameProps {
  userName: string;
  rolesLabel: string;
  groups: ShellNavGroup[];
  envBadge?: string;
  /** From `GET /v1/admin/system/info`: the API runs with in-memory fakes. */
  apiFakes: boolean;
  fakesLabel: string;
  children: React.ReactNode;
}

/** The admin console frame (F1 1.3 §1): sidebar from `/v1/admin/me` entitlements, command palette, environment badge. */
export function AdminShellFrame(props: AdminShellFrameProps) {
  // Marks the document interactive (hydrated): the e2e suite waits for it instead of clicking
  // server-rendered buttons that do nothing yet (the SSE stream keeps the network busy).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "admin";
  }, []);
  const t = useTranslations();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed("admin");
  const items = props.groups.flatMap((group) => group.items);
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
          <Link href="/" aria-label={t("shell.home")}>
            <Wordmark size="sm" />
          </Link>
          <span className="truncate text-sm font-semibold" data-testid="platform-user">
            {props.userName}
          </span>
          <span className="text-muted hidden text-xs sm:inline" data-testid="platform-roles">
            {props.rolesLabel}
          </span>
          <span className="ms-auto flex items-center gap-1">
            <EnvBadge label={props.envBadge} />
            {props.apiFakes ? (
              <Badge tone="info" size="sm" icon={IconInfo}>
                {props.fakesLabel}
              </Badge>
            ) : null}
            <CommandPalette items={items} />
            <NotificationCentre zone="admin" />
            <LanguageSwitch zone="admin" />
            <UserMenu displayName={props.userName} roleLabel={props.rolesLabel} loginHref="/login" />
          </span>
        </TopBar>
      }
      sidebar={<ZoneSidebar groups={props.groups} collapsed={collapsed} />}
    >
      <ShellBreadcrumbs items={items} home={undefined}>
        {props.children}
      </ShellBreadcrumbs>
    </AppShell>
  );
}
