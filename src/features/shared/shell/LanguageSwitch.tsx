"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { usePathname as useLocalePathname, useRouter as useLocaleRouter } from "@/i18n/navigation";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, routing, type Locale } from "@/i18n/routing";
import { IconButton } from "@/ui/components/IconButton";
import { LazyDropdownMenu } from "@/ui/components/overlays";
import { Icon } from "@/ui/icons";
import { IconLanguage } from "@/ui/icons/glyphs/language";

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
export function LanguageSwitch({
  zone,
  variant = "icon",
}: {
  zone: "owner" | "staff" | "admin";
  /** `row`: a full-width list row ("ภาษา · ไทย") in the phone's "More" sheet. */
  variant?: "icon" | "row";
}) {
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
    <LazyDropdownMenu
      label={t("label")}
      trigger={
        variant === "row" ? (
          <button
            type="button"
            data-testid="language-switch-row"
            className="rounded-control hover:bg-bg-subtle focus-visible:ring-focus-ring flex h-12 w-full items-center gap-3 px-2 text-start focus-visible:ring-2 focus-visible:outline-none"
          >
            <Icon icon={IconLanguage} className="text-muted text-lg" />
            <span className="flex-1 font-medium">{t("label")}</span>
            <span className="text-muted text-sm">{t(locale)}</span>
          </button>
        ) : (
          <IconButton icon={IconLanguage} label={t("label")} data-testid="language-switch" />
        )
      }
      items={routing.locales.map((value) => ({
        id: value,
        label: t(value),
        selected: value === locale,
        onSelect: () => choose(value),
      }))}
    />
  );
}
