import { getTranslations, setRequestLocale } from "next-intl/server";

import { LeasesView } from "@/features/owner/leases/LeasesView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.nav");
  return { title: t("leases") };
}

/** Leases (F2 2.2). */
export default async function Leases({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LeasesView context={await ownerContext()} searchParams={await searchParams} />;
}
