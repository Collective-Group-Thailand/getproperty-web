import { getLocale, getTranslations } from "next-intl/server";

import { MarketingFrame } from "@/features/owner/marketing/MarketingFrame";
import { ZoneNotFound } from "@/features/shared/errors/ZoneNotFound";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconHelp } from "@/ui/icons/glyphs/help";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconSearch } from "@/ui/icons/glyphs/search";

/**
 * The owner host's 404 (unknown paths, refused segments, a listing or guide that does not exist): inside the public
 * site's header and footer so the visitor can carry on, with the pages people usually look for.
 */
export default async function OwnerNotFound() {
  const current = await getLocale();
  const locale = (routing.locales as readonly string[]).includes(current) ? (current as Locale) : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "owner.marketing.nav" });
  const e = await getTranslations({ locale, namespace: "errors.notFound" });
  const href = (path: string) => getPathname({ href: path, locale });
  return (
    <MarketingFrame locale={locale}>
      <ZoneNotFound
        homeHref={href("/")}
        secondary={{ href: href("/rent"), label: e("findRoom") }}
        links={[
          { href: href("/rent"), label: t("rent"), icon: IconSearch },
          { href: href("/landlords"), label: t("owners"), icon: IconBuilding },
          { href: href("/help"), label: t("help"), icon: IconHelp },
          { href: href("/contact"), label: t("contactPage"), icon: IconMail },
        ]}
      />
    </MarketingFrame>
  );
}
