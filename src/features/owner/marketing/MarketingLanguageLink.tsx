import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";

import { PATH_HEADER } from "@/lib/auth/guards-shared";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/ui/icons";
import { IconLanguage } from "@/ui/icons/glyphs/language";

/**
 * th ⇄ en on the public pages: the same page in the other language (its own indexable URL). Rendered
 * on the server from the request path, so the public pages ship no client i18n for it.
 */
export async function MarketingLanguageLink({ className }: { className?: string } = {}) {
  const t = await getTranslations("shell.languageSwitch");
  const locale = (await getLocale()) as Locale;
  const other: Locale = locale === "th" ? "en" : "th";
  const path = ((await headers()).get(PATH_HEADER) ?? "/").split("?")[0]!.replace(/^\/(th|en)(?=\/|$)/, "") || "/";
  return (
    <a
      href={getPathname({ href: path, locale: other })}
      hrefLang={other}
      lang={other}
      className={className ?? "hover:text-primary px-2 text-sm font-medium"}
    >
      <Icon icon={IconLanguage} className="me-1.5 align-[-0.15em]" />
      {t(other)}
    </a>
  );
}
