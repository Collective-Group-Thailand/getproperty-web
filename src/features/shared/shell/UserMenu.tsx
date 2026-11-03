"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { signOut } from "@/lib/auth/actions";
import { IconButton } from "@/ui/components/IconButton";
import { cn } from "@/ui/lib/cn";
import { useTheme } from "@/ui/theme/ThemeProvider";
import { LazyDropdownMenu } from "@/ui/components/overlays";
import { type MenuItem } from "@/ui/components/DropdownMenu";
import { IconLogOut } from "@/ui/icons/glyphs/log-out";
import { IconResident } from "@/ui/icons/glyphs/resident";
import { IconThemeContrast } from "@/ui/icons/glyphs/theme-contrast";
import { IconThemeDark } from "@/ui/icons/glyphs/theme-dark";
import { IconThemeLight } from "@/ui/icons/glyphs/theme-light";
import { IconThemeSystem } from "@/ui/icons/glyphs/theme-system";

const THEME_ICONS = {
  system: IconThemeSystem,
  light: IconThemeLight,
  dark: IconThemeDark,
  hc: IconThemeContrast,
} as const;

/**
 * Account menu of every shell: who is signed in (and in which role), theme (high contrast offered on
 * staff), extra entries from the zone, sign-out (revokes the sign-in upstream, D-163).
 */
export function UserMenu({
  displayName,
  roleLabel,
  loginHref,
  extraItems = [],
  size = "md",
  onSignOut,
  variant = "icon",
  collapsed = false,
}: {
  displayName: string;
  roleLabel?: string;
  loginHref: string;
  extraItems?: MenuItem[];
  /** The zone's own sign-out (the staff PWA cleans the device first, review H2/M4); default: the session only. */
  onSignOut?: () => void;
  /** `lg` (48 px) in the staff PWA (design-system.md §5). */
  size?: "md" | "lg";
  /**
   * `rail`: the account block pinned to the bottom of the console column — initial, name and role from `md` (the initial
   * alone while the column is collapsed and on phones). `icon` (default): a 44-px icon button.
   */
  variant?: "icon" | "rail";
  collapsed?: boolean;
}) {
  const t = useTranslations();
  const { choice, choices, setChoice } = useTheme();
  const [, startTransition] = useTransition();

  const items: MenuItem[] = [
    {
      id: "who",
      label: (
        <span className="flex flex-col">
          <span className="font-semibold">{displayName}</span>
          {roleLabel ? <span className="text-muted text-xs">{roleLabel}</span> : null}
        </span>
      ),
      disabled: true,
    },
    ...choices.map((value, index) => ({
      id: `theme-${value}`,
      label: t(`shell.themeChoice.${value}`),
      icon: THEME_ICONS[value],
      selected: value === choice,
      separatorBefore: index === 0,
      onSelect: () => setChoice(value),
    })),
    ...extraItems,
    {
      id: "sign-out",
      label: t("auth.signOut"),
      icon: IconLogOut,
      separatorBefore: true,
      onSelect: () =>
        onSignOut
          ? onSignOut()
          : startTransition(async () => {
              await signOut();
              window.location.assign(loginHref);
            }),
    },
  ];

  return (
    <LazyDropdownMenu
      label={t("shell.user.menu")}
      align={variant === "rail" ? "start" : undefined}
      trigger={
        variant === "rail" ? (
          <button
            type="button"
            aria-label={t("shell.user.signedInAs", { name: displayName })}
            data-testid="user-menu"
            className={cn(
              "rounded-control hover:bg-bg-subtle focus-visible:ring-focus-ring duration-fast flex h-11 min-w-11 items-center justify-center gap-3 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none",
              !collapsed && "md:w-full md:justify-start md:px-2",
            )}
          >
            <span
              aria-hidden="true"
              className="bg-primary-subtle text-primary-subtle-fg grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold"
            >
              {Array.from(displayName.trim())[0] ?? "?"}
            </span>
            <span className={cn("hidden min-w-0 flex-1 flex-col", !collapsed && "md:flex")}>
              <span className="truncate text-sm font-semibold">{displayName}</span>
              {roleLabel ? <span className="text-muted truncate text-xs">{roleLabel}</span> : null}
            </span>
          </button>
        ) : (
          <IconButton
            icon={IconResident}
            size={size}
            label={t("shell.user.signedInAs", { name: displayName })}
            data-testid="user-menu"
          />
        )
      }
      items={items}
    />
  );
}
