import { cookies, headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { isZone, ZONE_HEADER, type Zone } from "@/lib/zones";

import { loadMessages } from "./messages";
import { LOCALE_COOKIE, routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // The zone always comes from the proxy's header: a locale can also be requested explicitly outside
  // the owner zone (`getTranslations({ locale })` in the staff manifest route), and must not switch the
  // catalog to the owner's. The owner's locale comes from its `[locale]` segment.
  const fromRequest = await resolveFromRequest();
  const { locale, zone } = hasLocale(routing.locales, requested)
    ? { locale: requested, zone: fromRequest.zone }
    : fromRequest;

  return {
    locale,
    // Every date the API returns is rendered in Bangkok time, wherever the user is (CLAUDE.md).
    timeZone: "Asia/Bangkok",
    messages: await loadMessages(locale, zone),
  };
});

/** Staff, admin: zone from the proxy's header, locale from the cookie (th default). */
async function resolveFromRequest(): Promise<{ locale: (typeof routing.locales)[number]; zone: Zone }> {
  const zoneHeader = (await headers()).get(ZONE_HEADER);
  const zone = isZone(zoneHeader) ? zoneHeader : "owner";

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = hasLocale(routing.locales, cookieLocale) ? cookieLocale : routing.defaultLocale;

  return { locale, zone };
}
