import { getTranslations, setRequestLocale } from "next-intl/server";

import { MandatesView } from "@/features/owner/agency/MandatesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("mandates") };
}

/** Agency mandates: an owner's invitations and an agency's inbox (G2, D-293). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MandatesView context={await ownerContext()} searchParams={await searchParams} />;
}
