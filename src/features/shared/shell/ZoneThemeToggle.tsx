"use client";

import { useTranslations } from "next-intl";

import { ThemeToggle } from "@/ui/theme/ThemeToggle";

/** The theme picker with its copy resolved — the `src/ui` component takes labels as props. */
export function ZoneThemeToggle() {
  const t = useTranslations("shell");
  return (
    <ThemeToggle
      label={t("theme")}
      choiceLabels={{
        system: t("themeChoice.system"),
        light: t("themeChoice.light"),
        dark: t("themeChoice.dark"),
        hc: t("themeChoice.hc"),
      }}
    />
  );
}
