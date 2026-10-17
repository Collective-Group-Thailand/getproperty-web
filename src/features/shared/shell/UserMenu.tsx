"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { signOut } from "@/lib/auth/actions";
import { DropdownMenu, type MenuItem } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { useTheme } from "@/ui/theme/ThemeProvider";

const THEME_ICONS = { system: "theme-system", light: "theme-light", dark: "theme-dark", hc: "theme-contrast" } as const;

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
      icon: "log-out",
      separatorBefore: true,
      onSelect: () =>
        startTransition(async () => {
          await signOut();
          window.location.assign(loginHref);
        }),
    },
  ];

  return (
    <DropdownMenu
      label={t("shell.user.menu")}
      trigger={
        <IconButton name="resident" label={t("shell.user.signedInAs", { name: displayName })} data-testid="user-menu" />
      }
      items={items}
    />
  );
}
