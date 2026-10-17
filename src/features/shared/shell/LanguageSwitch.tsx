"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { usePathname as useLocalePathname, useRouter as useLocaleRouter } from "@/i18n/navigation";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, routing, type Locale } from "@/i18n/routing";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";

/** `gp_locale` carries no identity, so the switcher writes it directly (like `gp_theme`). */
function writeLocaleCookie(locale: Locale): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

/**
 * th / en (D-064). The owner host keeps the language in the URL (`/en/...`); the staff and admin hosts
 * in the JS-readable `gp_locale` cookie (no identity in it), so switching there writes the cookie and
 * re-renders.
 */
export function LanguageSwitch({ zone }: { zone: "owner" | "staff" | "admin" }) {
  const t = useTranslations("shell.languageSwitch");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const localeRouter = useLocaleRouter();
  const localePathname = useLocalePathname();

  const choose = (next: Locale) => {
    if (next === locale) return;
    if (zone === "owner") {
      localeRouter.replace(localePathname, { locale: next });
      return;
    }
    writeLocaleCookie(next);
    router.refresh();
  };

  return (
    <DropdownMenu
      label={t("label")}
      trigger={<IconButton name="language" label={t("label")} data-testid="language-switch" />}
      items={routing.locales.map((value) => ({
        id: value,
        label: t(value),
        selected: value === locale,
        onSelect: () => choose(value),
      }))}
    />
  );
}
