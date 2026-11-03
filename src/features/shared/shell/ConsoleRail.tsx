"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { IconButton } from "@/ui/components/IconButton";
import { IconSidebarCollapse } from "@/ui/icons/glyphs/sidebar-collapse";
import { IconSidebarExpand } from "@/ui/icons/glyphs/sidebar-expand";
import { cn } from "@/ui/lib/cn";

import type { ShellBrand } from "./brand";
import { BrandSlot } from "./BrandSlot";

export interface ConsoleRailProps {
  brand: ShellBrand;
  homeHref: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Who and where: the organisation (or the platform user), the role, the building switcher. */
  workspace?: React.ReactNode;
  /** The search / jump-to trigger (`variant="rail"`): an icon on phones, a field-like button in the column. */
  search?: React.ReactNode;
  /** The grouped menu (`ZoneSidebar`); shown from `md` — phones use the bottom nav or the menu sheet. */
  nav: React.ReactNode;
  /** Small tools beside the account: notifications, language, environment badge. */
  tools?: React.ReactNode;
  /** The account menu (`UserMenu variant="rail"`), pinned to the bottom of the column. */
  account: React.ReactNode;
  /** Phones only: a button that opens the whole menu in a sheet (zones without a bottom nav). */
  mobileMenu?: React.ReactNode;
  /** Accessible name of the menu landmark. */
  navLabel: string;
}

/**
 * The console's one navigation column (REDESIGN-PROMPT §6.3, G0). One element, two layouts: a 56-px top bar on phones
 * (house, organisation, search, notifications, account) and, from `md`, a full-height column — logo, workspace,
 * search, the menu scrolling on its own, the account pinned at the bottom. Every control is rendered once, so the
 * page never holds two copies of a switcher or a menu.
 */
export function ConsoleRail(props: ConsoleRailProps) {
  const t = useTranslations("shell");
  const { collapsed } = props;
  return (
    <aside
      className={cn(
        "border-border bg-surface z-sticky sticky top-0 flex h-14 items-center gap-1 border-b px-2",
        "md:h-dvh md:shrink-0 md:flex-col md:items-stretch md:gap-0 md:border-e md:border-b-0 md:px-0",
        "motion-safe:duration-slow motion-safe:transition-[width]",
        collapsed ? "md:w-16" : "md:w-64",
      )}
      data-testid="console-rail"
      data-collapsed={collapsed ? "true" : undefined}
    >
      <div className={cn("flex shrink-0 items-center gap-1 md:h-16 md:px-4", collapsed && "md:justify-center md:px-0")}>
        {props.mobileMenu ? <span className="md:hidden">{props.mobileMenu}</span> : null}
        <Link
          href={props.homeHref}
          aria-label={t("home")}
          className={cn("rounded-control inline-flex shrink-0 items-center px-1", collapsed && "md:hidden")}
        >
          <BrandSlot brand={props.brand} collapsed={collapsed} />
        </Link>
        <IconButton
          icon={collapsed ? IconSidebarExpand : IconSidebarCollapse}
          label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          onClick={props.onToggleCollapsed}
          className={cn("hidden md:inline-flex", !collapsed && "ms-auto")}
        />
      </div>

      {props.workspace ? (
        <div
          className={cn("flex min-w-0 flex-1 flex-col md:flex-none md:gap-2 md:px-3 md:pb-3", collapsed && "md:hidden")}
        >
          {props.workspace}
        </div>
      ) : (
        <span className="flex-1 md:hidden" />
      )}

      {props.search ? (
        <div className={cn("shrink-0 md:px-3 md:pb-2", collapsed && "md:flex md:justify-center md:px-0")}>
          {props.search}
        </div>
      ) : null}

      <nav
        aria-label={props.navLabel}
        className="border-border relative hidden min-h-0 flex-1 overflow-y-auto overscroll-contain border-t py-3 md:block"
      >
        {props.nav}
      </nav>

      <div
        className={cn(
          "flex shrink-0 items-center gap-1",
          "md:border-border md:flex-col md:items-stretch md:gap-2 md:border-t md:p-3",
          collapsed && "md:items-center md:px-0",
        )}
      >
        {props.tools ? (
          <div className={cn("flex items-center gap-1", collapsed && "md:flex-col")}>{props.tools}</div>
        ) : null}
        {props.account}
      </div>
    </aside>
  );
}

/** The organisation and role block at the top of the column (on phones: the organisation alone, truncated). */
export function RailWorkspace({
  name,
  role,
  switcher,
  extra,
  nameTestId,
  roleTestId,
}: {
  name: React.ReactNode;
  role?: React.ReactNode;
  /** Replaces the name when the person can switch (several organisations). */
  switcher?: React.ReactNode;
  /** A second line of context under the role: the building switcher. */
  extra?: React.ReactNode;
  nameTestId?: string;
  roleTestId?: string;
}) {
  return (
    <>
      <div className="flex min-w-0 flex-col px-1 md:px-0" data-testid="session-summary">
        {switcher ?? (
          <span className="truncate text-sm font-semibold md:text-base" data-testid={nameTestId}>
            {name}
          </span>
        )}
        {role && !switcher ? (
          <span className="text-muted hidden truncate text-xs md:block" data-testid={roleTestId}>
            {role}
          </span>
        ) : null}
      </div>
      {extra ? <div className="hidden md:block">{extra}</div> : null}
    </>
  );
}
