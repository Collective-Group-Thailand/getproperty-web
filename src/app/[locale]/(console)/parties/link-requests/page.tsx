import { getTranslations, setRequestLocale } from "next-intl/server";

import { LinkRequestsView } from "@/features/owner/parties/LinkRequestsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.parties.linkRequests");
  return { title: t("title") };
}

/** Phone sign-ins waiting for the Owner (D-226). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LinkRequestsView context={await ownerContext()} searchParams={await searchParams} />;
}
