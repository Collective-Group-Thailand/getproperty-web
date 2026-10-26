import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { openShareLink } from "@/features/owner/marketing/publicApi";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: Locale; code: string }> };

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: true } };

/**
 * A short link of a listing's share kit (`/s/{code}`, D-268): the API counts the click and names the listing; the
 * visitor lands on it with the channel's UTM and `ch` (which the LINE contact button carries to the enquiry). A link
 * to a listing that is no longer public lands on the search instead.
 */
export default async function ShortLinkPage({ params }: Params) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const target = await openShareLink(code);
  if (!target) redirect(getPathname({ href: "/rent", locale }));
  const query = new URLSearchParams({
    utm_source: target.utm.source,
    utm_medium: target.utm.medium,
    utm_campaign: target.utm.campaign,
    ch: target.channel,
  });
  redirect(`${getPathname({ href: `/rent/${target.slug}`, locale })}?${query.toString()}`);
}
