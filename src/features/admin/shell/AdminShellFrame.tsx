"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { NotificationCentre } from "@/features/shared/notifications/NotificationCentre";
import type { ShellBrand } from "@/features/shared/shell/brand";
import { ConsoleRail, RailWorkspace } from "@/features/shared/shell/ConsoleRail";
import { LanguageSwitch } from "@/features/shared/shell/LanguageSwitch";
import { RailSearchButton } from "@/features/shared/shell/RailSearchButton";
import { signOut } from "@/lib/auth/actions";
import { MenuRow } from "@/ui/components/MenuRow";
import { IconLogOut } from "@/ui/icons/glyphs/log-out";
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

import { CommandPalette, openCommandPalette } from "./CommandPalette";

export interface AdminShellFrameProps {
  userName: string;
  rolesLabel: string;
  groups: ShellNavGroup[];
  envBadge?: string;
  /** From `GET /v1/admin/system/info`: the API runs with in-memory fakes. */
  apiFakes: boolean;
  fakesLabel: string;
  /** The logo, rendered by the server shell (`shellBrand()`). */
  brand: ShellBrand;
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
  const [signingOut, startSignOut] = useTransition();
  const items = props.groups.flatMap((group) => group.items);
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
              <RailWorkspace
                name={props.userName}
                nameTestId="platform-user"
                role={props.rolesLabel}
                roleTestId="platform-roles"
              />
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
          nav={<ZoneSidebar groups={props.groups} collapsed={collapsed} />}
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
      {/* Phones (Stitch revision): a full-height menu from the start edge — who and which environment at the top, a
          field-like jump-to, the grouped menu scrolling on its own, language and sign-out pinned at the foot. */}
      <LazySheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t("shell.moreMenu")}
        closeLabel={t("common.close")}
        side="left"
        footer={
          <>
            <LanguageSwitch zone="admin" variant="row" />
            <MenuRow
              icon={IconLogOut}
              tone="danger"
              disabled={signingOut}
              onClick={() =>
                startSignOut(async () => {
                  await signOut();
                  window.location.replace("/login");
                })
              }
            >
              {t("auth.signOut")}
            </MenuRow>
          </>
        }
      >
        <div className="flex flex-col gap-5 pb-2">
          <div className="border-border flex flex-col gap-2 border-b pb-4">
            <span className="font-semibold">{props.userName}</span>
            <span className="text-muted text-sm">{props.rolesLabel}</span>
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
          </div>
          <RailSearchButton
            label={t("shell.commandPalette.open")}
            placeholder={t("shell.commandPalette.title")}
            variant="field"
            testId="command-palette-sheet"
            onClick={() => {
              setMenuOpen(false);
              openCommandPalette();
            }}
          />
          <div className="-mx-5">
            <ZoneSidebar groups={props.groups} collapsed={false} size="touch" />
          </div>
        </div>
      </LazySheet>
    </AppShell>
  );
}
