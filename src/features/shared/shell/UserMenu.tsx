"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { signOut } from "@/lib/auth/actions";
import { IconButton } from "@/ui/components/IconButton";
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
}: {
  displayName: string;
  roleLabel?: string;
  loginHref: string;
  extraItems?: MenuItem[];
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
        startTransition(async () => {
          await signOut();
          window.location.assign(loginHref);
        }),
    },
  ];

  return (
    <LazyDropdownMenu
      label={t("shell.user.menu")}
      trigger={
        <IconButton
          icon={IconResident}
          label={t("shell.user.signedInAs", { name: displayName })}
          data-testid="user-menu"
        />
      }
      items={items}
    />
  );
}
