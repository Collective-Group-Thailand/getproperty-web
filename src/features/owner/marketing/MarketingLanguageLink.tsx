import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";

import { PATH_HEADER } from "@/lib/auth/guards-shared";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * th ⇄ en on the public pages: the same page in the other language (its own indexable URL). Rendered
 * on the server from the request path, so the public pages ship no client i18n for it.
 */
export async function MarketingLanguageLink() {
  const t = await getTranslations("shell.languageSwitch");
  const locale = (await getLocale()) as Locale;
  const other: Locale = locale === "th" ? "en" : "th";
  const path = ((await headers()).get(PATH_HEADER) ?? "/").split("?")[0]!.replace(/^\/(th|en)(?=\/|$)/, "") || "/";
  return (
    <a
      href={getPathname({ href: path, locale: other })}
      hrefLang={other}
      lang={other}
      className="hover:text-primary px-2 text-sm font-medium"
    >
      {t(other)}
    </a>
  );
}
