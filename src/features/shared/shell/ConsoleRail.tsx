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
  /** The collapsed column's stand-in for `workspace`: the organisation's initial square, the building as an icon. */
  collapsedWorkspace?: React.ReactNode;
  /** `false`: the account lives in the phone's "More" sheet, not in the 56-px top bar (owner). Default `true`. */
  accountOnPhone?: boolean;
  /** The logo on phones: the full wordmark (owner — the building chip carries the scope) or the house alone. */
  phoneBrand?: "full" | "compact";
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
      {/* The logo and the collapse toggle stay at the top in both states (the toggle never moves): side by side in the
          expanded column, stacked in the 64-px rail. */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 md:h-16 md:px-4",
          collapsed && "md:h-auto md:flex-col md:gap-1 md:px-0 md:pt-3 md:pb-2",
        )}
      >
        {props.mobileMenu ? <span className="md:hidden">{props.mobileMenu}</span> : null}
        <Link
          href={props.homeHref}
          aria-label={t("home")}
          className={cn(
            "rounded-control inline-flex shrink-0 items-center px-1",
            collapsed && "md:size-11 md:justify-center md:px-0",
          )}
        >
          <BrandSlot brand={props.brand} collapsed={collapsed} phone={props.phoneBrand} />
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
      {collapsed && props.collapsedWorkspace ? (
        <div className="border-border hidden flex-col items-center gap-1 border-t py-2 md:flex">
          {props.collapsedWorkspace}
        </div>
      ) : null}

      {props.search ? (
        <div className={cn("shrink-0 md:px-3 md:pb-2", collapsed && "md:flex md:justify-center md:px-0 md:pb-1")}>
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
        {props.accountOnPhone === false ? <div className="hidden md:contents">{props.account}</div> : props.account}
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
  phone,
}: {
  name: React.ReactNode;
  role?: React.ReactNode;
  /** Replaces the name when the person can switch (several organisations). */
  switcher?: React.ReactNode;
  /** The building switcher: a compact chip at the end of the organisation row (from `md`). */
  extra?: React.ReactNode;
  /** What the phone's top bar shows instead of the organisation's name (owner: the building chip). */
  phone?: React.ReactNode;
  nameTestId?: string;
  roleTestId?: string;
}) {
  // The organisation and its role on the left, the building chip on the same row (one row shorter than stacking it —
  // the money group then fits above the fold at 900 px).
  return (
    <>
      <div
        className={cn("flex min-w-0 items-center gap-2 px-1 md:px-0", phone && "hidden md:flex")}
        data-testid="session-summary"
      >
        <div className="flex min-w-0 flex-1 flex-col">
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
        {extra ? <div className="hidden max-w-[50%] shrink-0 md:block">{extra}</div> : null}
      </div>
      {phone ? <div className="flex min-w-0 items-center md:hidden">{phone}</div> : null}
    </>
  );
}

/** The organisation's initial in a pale square — the collapsed rail's stand-in for the workspace block. */
export function RailInitial({ name, role }: { name: string; role?: string }) {
  const label = role ? `${name} · ${role}` : name;
  return (
    <span
      title={label}
      className="bg-primary-subtle text-primary-subtle-fg rounded-control grid size-9 place-items-center text-sm font-semibold"
    >
      <span aria-hidden="true">{Array.from(name.trim())[0] ?? "?"}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
