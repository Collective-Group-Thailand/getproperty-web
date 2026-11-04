import { getLocale, getTranslations } from "next-intl/server";

import { OWNER_BOTTOM_NAV, OWNER_MENU } from "@/features/owner/shell/menu";
import { ZoneNotFound } from "@/features/shared/errors/ZoneNotFound";
import { entitledMenu } from "@/features/shared/shell/menu";
import { getOperatorActor } from "@/lib/auth/actor";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * A record or page of the console that does not exist (a deleted lease, a mistyped id): inside the console column, with
 * the way back to the first page of the bottom nav and the other everyday pages the member is entitled to.
 */
export default async function ConsoleNotFound() {
  const locale = (await getLocale()) as Locale;
  const actor = await getOperatorActor("owner");
  const t = await getTranslations("owner.nav");
  const e = await getTranslations("errors.notFound");
  const menu = entitledMenu(actor?.me.menu ?? [], OWNER_MENU);
  const everyday = OWNER_BOTTOM_NAV.flatMap(({ key }) => menu.filter((item) => item.key === key)).slice(0, 4);
  const href = (path: string) => getPathname({ href: path, locale });
  const home = everyday[0];
  return (
    <ZoneNotFound
      homeHref={href(home?.href ?? "/dashboard")}
      homeLabel={home ? e("goTo", { page: t(home.key as Parameters<typeof t>[0]) }) : undefined}
      links={everyday.slice(1).map((item) => ({
        href: href(item.href),
        label: t(item.key as Parameters<typeof t>[0]),
        icon: item.icon,
      }))}
    />
  );
}
