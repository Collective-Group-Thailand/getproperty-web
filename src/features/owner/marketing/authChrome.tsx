import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { AuthShowcase } from "./BillMessage";
import { MarketingLanguageLink } from "./MarketingLanguageLink";
import { serverEnv } from "@/lib/env/server";

import { marketingOrigin } from "./seo";

/**
 * What the owner host's sign-in pages add to the shared auth frame: the wordmark back to the public site, the language
 * switch and the way back, the split frame's product panel (an illustrative LINE bill), and the terms and privacy links at the foot — the same chrome on `/login`, `/signup`, `/join` (which lands on
 * `/login`) and `/select-tenant`.
 */
export async function ownerAuthChrome(locale: Locale) {
  const t = await getTranslations("owner.marketing.legal.docs");
  const nav = await getTranslations("owner.marketing.nav");
  // The public pages live on the platform's public site when there is one (the owner host would only redirect there).
  const site = (path: string) =>
    `${serverEnv().MARKETING_HOST ? marketingOrigin() : ""}${getPathname({ href: path, locale })}`;
  return {
    homeHref: site("/"),
    aside: (
      <>
        <MarketingLanguageLink className="hover:text-fg inline-flex min-h-11 items-center px-2 font-medium" />
        <a href={site("/")} className="text-fg hover:text-primary inline-flex min-h-11 items-center px-2 font-medium">
          {nav("backHome")}
        </a>
      </>
    ),
    showcase: <AuthShowcase locale={locale} />,
    legal: (["terms", "privacy"] as const).map((doc) => ({
      href: site(`/legal/${doc}`),
      label: t(`${doc}.title`),
    })),
  };
}
